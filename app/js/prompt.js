// Builds the text a traveler pastes into their own AI. Pure: same input, same output.

import { addDays } from './util.js';
import { distanceTo, fmtKm, sortByDistance } from './geo.js';
import { cities, districtsOf } from './data.js';
import { dayNumber, entryName } from './triplog.js';
import { tripBlock } from './trip.js';
import { planRequestSuffix } from './aiplan.js';

/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./types.js').Pos} Pos */
/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').AskContext} AskContext */

/**
 * Options for the "Plan a day" area picker: each city, followed by its districts.
 * @param {Place[]} places
 * @returns {{ value: string, label: string }[]}  value is "city:<city>" or "district:<city>|<district>"
 */
export function areaOptions(places) {
  const opts = [];
  for (const city of cities(places)) {
    opts.push({ value: `city:${city}`, label: city });
    for (const d of districtsOf(places, city)) opts.push({ value: `district:${city}|${d}`, label: `  ${d}, ${city}` });
  }
  return opts;
}

/**
 * Human name of the chosen area.
 * @param {string} area        see AskContext.area
 * @param {string} customArea
 * @returns {string}  "Taipei City", "Datong District, Taipei City", or the trimmed custom text ("" if none)
 */
export function areaLabel(area, customArea) {
  if (area.startsWith('city:')) return area.slice(5);
  if (area.startsWith('district:')) {
    const [city, district] = area.slice(9).split('|');
    return `${district}, ${city}`;
  }
  return customArea.trim();
}

/**
 * Guidebook places in the chosen area.
 * For custom text, a place matches when the core of its district or city name
 * (without "District"/"City"/...) appears in the text, case-insensitive:
 * "Da'an District, Taipei" matches every Taipei City place, but not New Taipei City.
 * @param {Place[]} places
 * @param {string} area
 * @param {string} customArea
 * @returns {Place[]}
 */
export function areaPlaces(places, area, customArea) {
  if (area.startsWith('city:')) return places.filter(p => p.location.city_en === area.slice(5));
  if (area.startsWith('district:')) {
    const [city, district] = area.slice(9).split('|');
    return places.filter(p => p.location.city_en === city && p.location.district_en === district);
  }
  const text = customArea.toLowerCase();
  if (!text.trim()) return [];
  const core = s => s.toLowerCase().replace(/\b(district|city|county|township)\b/g, '').trim();
  return places.filter(p => {
    const d = core(p.location.district_en), c = core(p.location.city_en);
    return (d && hasWord(text, d)) || (c && hasWord(text, c));
  });
}

function hasWord(text, word) {
  const i = text.indexOf(word);
  if (i < 0) return false;
  // "new taipei" contains "taipei"; only count it when the match is not preceded by another word
  const before = text.slice(0, i).trimEnd();
  return !/new$/.test(before);
}

/**
 * Places within radius of pos, nearest first. If none are within radius, the 3 nearest instead.
 * @param {Place[]} places
 * @param {Pos|null} pos
 * @param {number} radius  km
 * @returns {{ list: Place[], within: boolean }}  within=false means "list is the fallback 3 nearest"
 */
export function nearPlaces(places, pos, radius) {
  if (!pos) return { list: [], within: true };
  const sorted = sortByDistance(places, pos);
  const within = sorted.filter(p => /** @type {number} */ (distanceTo(p, pos)) <= radius);
  return within.length ? { list: within, within: true } : { list: sorted.slice(0, 3), within: false };
}

/**
 * The suggested question shown until the user edits it.
 * @param {'near'|'plan'} mode
 * @param {'today'|'tomorrow'} day
 * @param {string} area  areaLabel() result, may be ""
 * @returns {string}
 */
export function defaultQuestion(mode, day, area) {
  if (mode === 'near') {
    return 'What should I do in the next few hours around here? Keep my likes and dislikes in mind.';
  }
  return `Suggest a plan for ${day}${area ? ` in ${area}` : ''}: a few places in a sensible walking order, and somewhere to eat. Keep my likes and dislikes in mind.`;
}

/**
 * Short multi-line description of one place for the area prompt (summary level, English only).
 * @param {Place} place
 * @param {number} index        0-based; printed as index + 1
 * @param {number|null} distKm  printed when not null
 * @param {boolean} [withId]    append " [id: <id>]" so the AI can reference the place in a JSON plan
 * @returns {string}
 */
export function placeBrief(place, index, distKm, withId = false) {
  const g = place.foreign_visitor_guide || {};
  const lines = [
    `${index + 1}. ${place.name.en} (${place.name.zh_TW}), ${place.location.district_en}, ${place.location.city_en}${distKm != null ? `, ${fmtKm(distKm)} away` : ''}${withId ? ` [id: ${place.id}]` : ''}`,
    `   ${place.summary.en}`,
  ];
  if (g.must_see_spots_en?.length) lines.push(`   Don't miss: ${g.must_see_spots_en.join('; ')}`);
  if (g.best_time_to_visit) lines.push(`   Best time: ${g.best_time_to_visit}`);
  if (g.recommended_duration_min) lines.push(`   Suggested visit: about ${g.recommended_duration_min} min`);
  return lines.join('\n');
}

/**
 * The trip log as prompt text, oldest first. "" when the log is empty.
 * Line format: "- 2026-11-03, Longshan Temple: 2/5, boring for me"
 * @param {LogEntry[]} log
 * @param {Place[]} places
 * @returns {string}
 */
export function logBlock(log, places) {
  if (!log.length) return '';
  const sorted = [...log].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
  const lines = sorted.map(e => {
    const bits = [e.stars ? `${e.stars}/5` : '', e.note].filter(Boolean).join(', ');
    return `- ${e.date}, ${entryName(e, places)}${bits ? `: ${bits}` : ''}`;
  });
  return `What I've done on this trip and how I felt about it:\n${lines.join('\n')}`;
}

/**
 * The full Ask AI prompt. Paragraphs, in order:
 * 1. who/when (+ trip day number if the log is not empty)
 * 2. near: where I am (GPS rounded to 3 decimals, or the picked place) / plan: area and date
 * 3. trip log (only if includeLog and not empty)
 * 4. the loaded plan for the target date (near: today; plan: today/tomorrow), if ctx.trip has that day
 * 5. guidebook places (near: within radius or 3 nearest fallback; plan: areaPlaces); with ids when wantPlan
 * 6. "guidebook is limited, suggest other places too"
 * 7. "My question: ..." (ctx.question, or defaultQuestion when null)
 * 8. planRequestSuffix() when wantPlan
 * @param {AskContext} ctx
 * @returns {string}
 */
export function buildAskPrompt(ctx) {
  const parts = [];
  const day = dayNumber(ctx.log, ctx.today);
  parts.push(`I'm a visitor traveling in Taiwan. Today is ${ctx.today}${day ? ` (day ${day} of my trip)` : ''}.`);

  let list = [];
  let listTitle = '';
  let withDistance = false;
  if (ctx.mode === 'near') {
    if (ctx.pos) {
      if (ctx.pos.source === 'gps') {
        const nearest = sortByDistance(ctx.places, ctx.pos)[0];
        parts.push(`I'm at GPS ${ctx.pos.lat.toFixed(3)}, ${ctx.pos.lng.toFixed(3)}${nearest ? `, closest guidebook place: ${nearest.name.en} in ${nearest.location.district_en}, ${nearest.location.city_en}` : ''}.`);
      } else {
        parts.push(`I'm near ${ctx.pos.label}.`);
      }
    } else {
      parts.push('(Location not set.)');
    }
    const near = nearPlaces(ctx.places, ctx.pos, ctx.radius);
    list = near.list;
    withDistance = true;
    listTitle = near.within
      ? `Places from my guidebook within ${ctx.radius} km:`
      : `My guidebook has nothing within ${ctx.radius} km. The nearest ones are:`;
  } else {
    const when = ctx.day === 'today' ? `today (${ctx.today})` : `tomorrow (${addDays(ctx.today, 1)})`;
    parts.push(`I plan to explore ${areaLabel(ctx.area, ctx.customArea) || '(area not set)'} ${when}.`);
    list = areaPlaces(ctx.places, ctx.area, ctx.customArea);
    listTitle = 'Places from my guidebook in or around this area:';
  }

  const log = ctx.includeLog ? logBlock(ctx.log, ctx.places) : '';
  if (log) parts.push(log);
  const targetDate = ctx.mode === 'plan' && ctx.day === 'tomorrow' ? addDays(ctx.today, 1) : ctx.today;
  const plan = ctx.trip ? tripBlock(ctx.trip, ctx.places, targetDate) : '';
  if (plan) parts.push(plan);
  if (list.length) {
    parts.push(`${listTitle}\n${list.map((p, i) => placeBrief(p, i, withDistance ? distanceTo(p, ctx.pos) : null, !!ctx.wantPlan)).join('\n')}`);
  }
  parts.push('My guidebook only covers selected historical and cultural sites, so also suggest other places (food, cafés, parks, markets, shopping) where they fit.');
  const question = ctx.question ?? defaultQuestion(ctx.mode, ctx.day, areaLabel(ctx.area, ctx.customArea));
  parts.push(`My question: ${question}`);
  if (ctx.wantPlan) parts.push(planRequestSuffix());
  return parts.join('\n\n');
}

/**
 * Full detail of one place for "Copy for AI" on the place page. Ends with "My question: " for the user to finish.
 * @param {Place} place
 * @param {LogEntry[]} notes  the user's log entries for this place
 * @returns {string}
 */
export function buildPlacePrompt(place, notes) {
  const g = place.foreign_visitor_guide || {};
  const c = place.cultural_significance || {};
  return [
    'Here is my guidebook entry for a place in Taiwan. Use it to answer my questions about it.',
    `${place.name.en} (${place.name.zh_TW})\n${place.location.address_en}`,
    `Summary: ${place.summary.en}`,
    `History: ${place.historical_narrative?.en || ''}`,
    c.why_it_matters_en && `Why it matters: ${c.why_it_matters_en}`,
    c.architectural_highlights_en && `Look for: ${c.architectural_highlights_en}`,
    g.must_see_spots_en?.length && `Don't miss: ${g.must_see_spots_en.join('; ')}`,
    g.etiquette_tips_en && `Etiquette: ${g.etiquette_tips_en}`,
    place.timeline?.length && `Timeline:\n${place.timeline.map(t => `- ${t.year_or_era}: ${t.event_en}`).join('\n')}`,
    notes.length && `My own notes: ${notes.map(e => [e.stars ? `${e.stars}/5` : '', e.note].filter(Boolean).join(', ')).join('; ')}`,
    'My question: ',
  ].filter(Boolean).join('\n\n');
}
