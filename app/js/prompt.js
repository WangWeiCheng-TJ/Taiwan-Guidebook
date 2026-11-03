// Builds the text a traveler pastes into their own AI. Pure: same input, same output.

import { addDays } from './util.js';
import { distanceTo, fmtKm, sortByDistance } from './geo.js';
import { cities, districtsOf } from './data.js';
import { dayNumber, entryName } from './triplog.js';
import { nextStop, tripBlock } from './trip.js';
import { planRequestSuffix } from './aiplan.js';

/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./types.js').Pos} Pos */
/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').AskContext} AskContext */
/** @typedef {import('./types.js').PhotoContext} PhotoContext */
/** @typedef {import('./types.js').PhotoShop} PhotoShop */

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
 * For custom text, a place matches when the core of its district or city name appears in the text:
 * the English name without "District"/"City"/... (case-insensitive), or the Chinese name without
 * 區/市/縣/鎮/鄉, with 臺 and 台 read as the same character.
 * "Da'an District, Taipei" matches every Taipei City place, but not New Taipei City; so does 台北市大安區.
 * "Tamsui, New Taipei, then Taipei" matches both cities (a later standalone "Taipei" still counts).
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
  const text = zhNorm(customArea.toLowerCase());
  if (!text.trim()) return [];
  const core = s => s.toLowerCase().replace(/\b(district|city|county|township)\b/g, '').trim();
  return places.filter(p => {
    const { district_en: de, city_en: ce, district_zh: dz, city_zh: cz } = p.location;
    const d = core(de), c = core(ce);
    if ((d && hasWord(text, d)) || (c && hasWord(text, c))) return true;
    return [zhCore(dz), zhCore(cz)].some(z => z && text.includes(z));
  });
}

/** 臺 and 台 are the same character in place names (臺南 = 台南). */
function zhNorm(s) {
  return String(s || '').replace(/臺/g, '台');
}

/**
 * A Chinese district or city name without its 區/市/縣/鎮/鄉 ending: 臺南市 → 台南, 中西區 → 中西.
 * A one-character core (東區 → 東) would match too much text, so such names keep their ending.
 * @param {string|undefined} s
 * @returns {string}
 */
function zhCore(s) {
  const t = zhNorm(s).trim();
  const c = t.replace(/[區市縣鎮鄉]$/, '');
  return c.length >= 2 ? c : t;
}

/**
 * True when word occurs in text other than as the end of "new <word>": "new taipei" contains "taipei",
 * which only counts as Taipei when "taipei" also occurs on its own somewhere in the text.
 * @param {string} text  lower case
 * @param {string} word  lower case
 * @returns {boolean}
 */
function hasWord(text, word) {
  for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) {
    if (!/new$/.test(text.slice(0, i).trimEnd())) return true;
  }
  return false;
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
 * @param {'en'|'zh_TW'} [lang]  language of the suggested question
 * @returns {string}
 */
export function defaultQuestion(mode, day, area, lang = 'en') {
  if (lang === 'zh_TW') {
    if (mode === 'near') return '接下來幾個小時，在這附近可以做什麼？請考慮我的喜好。';
    return `請幫我規劃${day === 'today' ? '今天' : '明天'}${area ? `在 ${area} ` : ''}的行程：幾個順路的地點，加上吃飯的地方。請考慮我的喜好。`;
  }
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
 * 1. who/when (+ trip day number if the log is not empty and today is on or after its first date),
 *    then the party size when ctx.party is a number:
 *    "I'm traveling alone." (1) or "We are <n> people." (absent/null: no sentence)
 * 2. near: where I am (GPS rounded to 3 decimals, or "somewhere in <picked city> (no GPS)") / plan: area and date
 * 3. trip log (only if includeLog and not empty)
 * 4. the loaded plan for the target date (near: today; plan: today/tomorrow), if ctx.trip has that day
 * 5. guidebook places (near with GPS: within radius or 3 nearest fallback, with distances; near with a picked
 *    city: that city's places, no distances and no radius, since the city's centre is no one's position;
 *    plan: areaPlaces); with ids when wantPlan
 * 5b. the owner's food picks for the city in question (ctx.food), if any
 * 6. "guidebook is limited, suggest other places too"
 * 7. "My question: ..." (ctx.question, or defaultQuestion in ctx.lang when null)
 * 8. "Please reply in Traditional Chinese (Taiwan)." when ctx.lang is zh_TW
 * 9. planRequestSuffix() when wantPlan
 * @param {AskContext} ctx
 * @returns {string}
 */
export function buildAskPrompt(ctx) {
  const parts = [];
  const day = dayNumber(ctx.log, ctx.today);
  // A log entry dated after today (picked ahead in the form) would make today "day -6": say nothing then.
  parts.push(`I'm a visitor traveling in Taiwan. Today is ${ctx.today}${day >= 1 ? ` (day ${day} of my trip)` : ''}.${partySentence(ctx.party)}`);

  let list = [];
  let listTitle = '';
  let withDistance = false;
  // A picked city is an area: list its places without distances (see gpsDistance in geo.js).
  const pickedCity = ctx.mode === 'near' && ctx.pos?.source === 'pick' ? ctx.pos.city || ctx.pos.label : '';
  const cityList = pickedCity ? ctx.places.filter(p => p.location.city_en === pickedCity) : [];
  if (ctx.mode === 'near' && cityList.length) {
    parts.push(`I'm somewhere in ${ctx.pos.label} (no GPS).`);
    list = cityList;
    listTitle = `Places from my guidebook in ${pickedCity}:`;
  } else if (ctx.mode === 'near') {
    if (ctx.pos) {
      if (ctx.pos.source === 'gps') {
        const nearest = sortByDistance(ctx.places, ctx.pos)[0];
        parts.push(`I'm at GPS ${ctx.pos.lat.toFixed(3)}, ${ctx.pos.lng.toFixed(3)}${nearest ? `, closest guidebook place: ${nearest.name.en} in ${nearest.location.district_en}, ${nearest.location.city_en}` : ''}.`);
      } else {
        parts.push(`I'm in ${ctx.pos.label} (no GPS; distances are from the middle of the city).`);
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
  const food = foodBlock(ctx.food || null);
  if (food) parts.push(food);
  parts.push('My guidebook only covers selected historical and cultural sites, so also suggest other places (food, cafés, parks, markets, shopping) where they fit.');
  const question = ctx.question ?? defaultQuestion(ctx.mode, ctx.day, areaLabel(ctx.area, ctx.customArea), ctx.lang);
  parts.push(`My question: ${question}`);
  if (ctx.lang === 'zh_TW') parts.push('Please reply in Traditional Chinese (Taiwan).');
  if (ctx.wantPlan) parts.push(planRequestSuffix());
  return parts.join('\n\n');
}

/**
 * Party size for the first paragraph of the Ask AI prompt, with a leading space; "" when not a number.
 * @param {number|null|undefined} n
 * @returns {string}
 */
function partySentence(n) {
  if (typeof n !== 'number') return '';
  return n === 1 ? " I'm traveling alone." : ` We are ${n} people.`;
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

/**
 * Question for "select text, ask AI what it means".
 * @param {{ text: string, context?: string, source?: string, lang?: 'en'|'zh_TW' }} q
 *   text     the selected words (trimmed; cut to 80 characters)
 *   context  the sentence or paragraph around it (cut to 300 characters); omitted when empty or equal to text
 *   source   where it was read, e.g. a place name or page title
 *   lang     UI language: the question is written in it and the AI is asked to reply in it
 * @returns {string}
 */
export function buildExplainPrompt({ text, context = '', source = '', lang = 'en' }) {
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const t = cut(text.trim().replace(/\s+/g, ' '), 80);
  const c = cut(context.trim().replace(/\s+/g, ' '), 300);
  const lines = lang === 'zh_TW'
    ? [`我在台灣旅行，正在看旅遊手冊。這裡的「${t}」是什麼意思？請用簡單的話解釋；如果是中文，也告訴我怎麼唸。`]
    : [`I'm a visitor in Taiwan reading my travel guide. What does "${t}" mean here? Explain it simply, and if it's Chinese, tell me how to pronounce it.`];
  if (c && c !== t) lines.push(lang === 'zh_TW' ? `上下文：「${c}」` : `Context: "${c}"`);
  if (source) lines.push(lang === 'zh_TW' ? `出處：${source}` : `From: ${source}`);
  if (lang === 'zh_TW') lines.push('Please reply in Traditional Chinese (Taiwan).');
  return lines.join('\n\n');
}

/** "Ask AI about a photo" presets, in display order. */
export const PHOTO_KINDS = /** @type {const} */ (['menu', 'sign', 'board', 'machine', 'label']);

/** @typedef {typeof PHOTO_KINDS[number]} PhotoKind */

const PHOTO_EN = {
  menu: 'a menu', sign: 'a sign or notice', board: 'a departure board or timetable',
  machine: 'a ticket machine or a form', label: 'a food label or ingredient list',
};

// What some travelers avoid. The app makes no claim about any food: it asks the AI to flag these.
const FLAGS = "pork, beef, seafood (fish or shellfish), offal, blood (such as pig's blood cake or duck blood) or peanuts";
const NEAR_KM = 1; // GPS this close to a guidebook place: "near <place>"
const CITY_KM = 15; // this close: "in or near <city>" (the same reach as the food picks in Ask AI)
const RIDE = 'line, platform and time, whether I need to change, and roughly how long the ride takes';

/** @type {Record<PhotoKind, (ctx: PhotoContext, next: string, plan: boolean) => string[]>} */
const PHOTO_ASKS = {
  menu: ctx => [
    'List every item on the menu, in its order: the Chinese exactly as written, an English name, the price if shown, and in a few words what it is (main ingredients, how it is cooked).',
    `Flag each item that has or may have ${FLAGS}. When the menu doesn't make it clear, mark the item "ask the staff" instead of guessing.`,
    ...(ctx.shop?.dish ? [`Find ${ctx.shop.name ? 'the recommended dish' : 'the dish I want to try'} (${ctx.shop.dish.zh_TW}) on the menu and include it in the order.`] : []),
    `Suggest an order for ${forWhom(ctx.party)}, with an estimated total cost in NT$.`,
    'For each suggested item, give the exact Chinese to point at on the menu, and one short sentence in Chinese I can show or say to order it.',
    'If the menu shows how ordering works here (an order sheet to fill in, paying first, a minimum charge), explain it.',
  ],
  sign: () => [
    'Translate all of the text, line by line: the Chinese as written, then English.',
    'Say in one or two sentences what it means for me as a visitor: a rule, a warning, opening hours, a closure, a price, directions or something else.',
    'Tell me whether I need to do anything (or avoid doing something) because of it.',
    'List any times, dates, prices, phone numbers or addresses on it.',
  ],
  board: (ctx, next, plan) => [
    'Read it: for each departure shown, the time, the line or train number, the type (such as local or express), the destination in Chinese and English, the platform or stop, and any status (delayed, cancelled).',
    next ? `Tell me which departure to take to reach my next stop: ${RIDE}.`
      : plan ? `Tell me which departure to take to reach the next stop on my plan that I haven't been to yet: ${RIDE}. If you can't tell which stop that is, ask me.`
        : `If you don't know where I'm going, ask me. Then tell me which departure to take: ${RIDE}.`,
    'Tell me if the kind of ticket matters for that departure (a reserved seat, an express fare, which cards work).',
    'Point out anything unusual on the board (delays, cancellations, a changed platform).',
  ],
  machine: ctx => [
    'Translate every button, option and field: the Chinese as written, then English.',
    `Walk me through it step by step: what to press, choose or write, in order${typeof ctx.party === 'number' ? `, for ${forWhom(ctx.party)}` : ' (ask me how many tickets if it matters)'}.`,
    'For a form: what to write in each field, which fields I can leave empty, and whether it needs a passport number or a local phone number.',
    'Say what payment it takes (coins, notes, cards) if the photo shows it.',
  ],
  label: () => [
    'Tell me what the product is, in English, and how it is eaten or prepared.',
    'Translate the full ingredient list.',
    `Flag any ${FLAGS} in it, and any allergens the label lists. When an ingredient is vague (such as "flavoring" or "animal fat"), say what it could contain and mark it "unclear".`,
    'Give the best-before or expiry date and how to store it, if the label shows them.',
  ],
};

/**
 * "Ask AI about a photo": the text a traveler pastes into their AI chat together with a photo they attach
 * there (the app never sees the photo). Pure. Paragraphs, in order:
 * 1. "(Attach your photo to this message before you send it.)", in lang: the traveler reads it when pasting
 * 2. "I'm a visitor traveling in Taiwan. Today is <today>[, <time>]." + the party sentence (as buildAskPrompt,
 *    only when ctx.party is a number) + where, unless ctx.shop says it:
 *    GPS within 1 km of a guidebook place: "I'm at GPS <lat>, <lng>, near <Place> (<中文>) in <district>, <city>."
 *    within 15 km: "I'm at GPS <lat>, <lng>, in or near <city>."; farther: "I'm at GPS <lat>, <lng>.";
 *    a picked city: "I'm somewhere in <city>."; no position: nothing
 * 3. ctx.shop: the pick's name and city, "Recommended here: <dish en> (<dish zh>)." and "Their tip: <hint en>";
 *    a dish with no shop: "I'm in <city> (<city zh>) to try a local dish: <dish en> (<dish zh>)."
 * 4. board only: today's plan (tripBlock) when ctx.trip has today
 * 5. "My next stop: <label>[ (<中文>), <district>, <city>][, planned for HH:MM]." when nextStop() finds one
 *    for ctx.today at ctx.time (every kind: it tells the AI how much time there is)
 * 6. "The attached photo shows <kind>. Please:" and a numbered list of what to give back:
 *    menu: every item in Chinese and English with what it is; flags for pork, beef, seafood, offal, blood and
 *      peanuts ("ask the staff" when unclear); the shop's dish found on the menu (ctx.shop.dish); an order for
 *      the party (one person, and how to scale it, while the party is not set) with an estimated cost in NT$;
 *      the exact Chinese to point at; how ordering works here
 *    sign: a line-by-line translation, what it means for a visitor, what to do, times/prices/numbers on it
 *    board: the departures read out; which one to take to the next stop (or to the next stop of today's plan,
 *      or ask where to) with line, platform and time; ticket kind; anything unusual
 *    machine: every button and field translated; step by step, for the party when set; forms; payment
 *    label: what it is; the full ingredient list; the same flags plus listed allergens; best-before date
 * 7. "Also keep in mind: <note>" when ctx.note is not blank
 * 8. say what can't be read instead of guessing; ask for the photo if none is attached
 * 9. "Please reply in Traditional Chinese (Taiwan)." when lang is zh_TW
 * An unknown kind is read as 'menu'.
 * @param {PhotoContext} ctx
 * @param {PhotoKind} kind
 * @param {'en'|'zh_TW'} [lang]
 * @returns {string}
 */
export function buildPhotoPrompt(ctx, kind, lang = 'en') {
  const k = PHOTO_KINDS.includes(/** @type {any} */ (kind)) ? kind : 'menu';
  const parts = [lang === 'zh_TW' ? '（送出前，請先把照片附在這則訊息裡。）' : '(Attach your photo to this message before you send it.)'];
  const where = ctx.shop ? '' : photoWhere(ctx.pos, ctx.places);
  parts.push(`I'm a visitor traveling in Taiwan. Today is ${ctx.today}${ctx.time ? `, ${ctx.time}` : ''}.${partySentence(ctx.party)}${where ? ` ${where}` : ''}`);
  if (ctx.shop) parts.push(shopText(ctx.shop));
  const plan = k === 'board' && ctx.trip ? tripBlock(ctx.trip, ctx.places, ctx.today) : '';
  if (plan) parts.push(plan);
  const stop = ctx.time ? nextStop(ctx.trip || null, ctx.places, ctx.today, ctx.time) : null;
  const next = stop ? stopText(stop) : '';
  if (next) parts.push(`My next stop: ${next}.`);
  const asks = PHOTO_ASKS[k](ctx, next, !!plan);
  parts.push(`The attached photo shows ${PHOTO_EN[k]}. Please:\n${asks.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  const note = (ctx.note || '').trim();
  if (note) parts.push(`Also keep in mind: ${note}`);
  parts.push("If part of the photo is blurry, cut off or hard to read, say what you can't read instead of guessing. If no photo is attached, ask me for it.");
  if (lang === 'zh_TW') parts.push('Please reply in Traditional Chinese (Taiwan).');
  return parts.join('\n\n');
}

/**
 * Who a menu order is for.
 * @param {number|null|undefined} n
 * @returns {string}
 */
function forWhom(n) {
  if (typeof n !== 'number') return 'one person (and say how to scale it for more people)';
  return n === 1 ? 'me alone' : `the ${n} of us`;
}

/**
 * Where the traveler is, for the photo prompt: near a guidebook place, in a city, or just GPS. "" without a position.
 * @param {Pos|null} pos
 * @param {Place[]} places
 * @returns {string}
 */
function photoWhere(pos, places) {
  if (!pos) return '';
  if (pos.source === 'pick') return `I'm somewhere in ${pos.city || pos.label}.`;
  const gps = `I'm at GPS ${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)}`;
  const nearest = sortByDistance(places, pos)[0];
  const d = nearest ? /** @type {number} */ (distanceTo(nearest, pos)) : Infinity;
  if (d <= NEAR_KM) return `${gps}, near ${nearest.name.en} (${nearest.name.zh_TW}) in ${nearest.location.district_en}, ${nearest.location.city_en}.`;
  if (d <= CITY_KM) return `${gps}, in or near ${nearest.location.city_en}.`;
  return `${gps}.`;
}

/**
 * The food pick or dish a menu photo is about.
 * @param {PhotoShop} shop
 * @returns {string}
 */
function shopText(shop) {
  const city = `${shop.city_en} (${shop.city_zh})`;
  const dish = shop.dish ? `${shop.dish.en} (${shop.dish.zh_TW})` : '';
  const lines = [];
  if (shop.name) {
    lines.push(`I'm at ${shop.name}, a place to eat in ${city} that a local friend recommends.`);
    if (dish) lines.push(`Recommended here: ${dish}.`);
  } else {
    lines.push(dish ? `I'm in ${city} to try a local dish: ${dish}.` : `I'm in ${city}.`);
  }
  if (shop.hint?.en) lines.push(`Their tip: ${shop.hint.en}`);
  return lines.join(' ');
}

/**
 * A plan stop for the photo prompt: "Chihkan Tower (赤崁樓), West Central District, Tainan City, planned for 09:00".
 * @param {{ item: import('./types.js').TripItem, place: Place|null, label: string }} stop
 * @returns {string}
 */
function stopText({ item, place, label }) {
  const where = place ? ` (${place.name.zh_TW}), ${place.location.district_en}, ${place.location.city_en}` : '';
  return `${label}${where}${item.time ? `, planned for ${item.time}` : ''}`;
}

const FOOD_KIND_EN = {
  taiwanese: 'Taiwanese local food', hotpot: 'hot pot', beef_noodles: 'beef noodles', ramen: 'ramen', japanese: 'Japanese',
  international: 'international', sweets: 'desserts', bar: 'bar',
};

/**
 * The owner's food picks as prompt text, grouped by kind. "" when there are none.
 * @param {import('./data.js').FoodCity|null} city
 * @returns {string}
 */
export function foodBlock(city) {
  if (!city || !(city.picks.length || (city.to_try || []).length)) return '';
  const byKind = new Map();
  for (const p of city.picks) {
    const k = p.local ? 'local' : p.kind;
    if (!byKind.has(k)) byKind.set(k, []);
    const notes = [p.dish && p.dish.en.toLowerCase(), p.hint && p.hint.en.replace(/\.$/, '')].filter(Boolean);
    byKind.get(k).push(p.name + (notes.length ? ` (${notes.join('; ')})` : ''));
  }
  // Local specialties first, then the usual kind order.
  const kindName = k => (k === 'local' ? city.local_label?.en || 'local specialties' : FOOD_KIND_EN[k] || k);
  const order = ['local', ...Object.keys(FOOD_KIND_EN)];
  const lines = [...byKind].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([k, names]) => `- ${kindName(k)}: ${names.join('; ')}`);
  const toTry = (city.to_try || []).map(d => `${d.dish.zh_TW} (${d.dish.en.toLowerCase()})`);
  if (toTry.length) lines.push(`- Local dishes I want to try, no shop chosen yet (recommend good places): ${toTry.join('; ')}`);
  return `Places to eat that a local friend recommends in ${city.city_en} (names as on Google Maps; look up where they are, and suggest ones that fit my plan):\n${lines.join('\n')}`;
}
