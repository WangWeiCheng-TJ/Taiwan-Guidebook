// "Taiwan through the places" (#/learn/timeline): every place's timeline events on one timeline, under the eras of
// Taiwan's history. Pure. Only what the data already holds: each event's year_or_era, era_category and text, and the
// places' eras (the schema's era names, which carry their years).
// Contract tests: tests/core/timeline.test.js

import { isPending } from './data.js';
import { tr } from './lang.js';

/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./lang.js').Lang} Lang */

/** The route argument of the timeline page (#/learn/timeline). build_dataset.py keeps topics off this id. */
export const TIMELINE_ID = 'timeline';

/**
 * The schema's eras (schema/attraction.schema.json, in its order) and the key of each one's heading in lang.js
 * (`era.<key>`). An era not listed here is shown as written.
 */
export const ERA_KEYS = Object.freeze({
  'Prehistoric & Indigenous': 'prehistoric',
  'Dutch & Spanish Era (1624–1662)': 'dutch-spanish',
  'Kingdom of Tungning (1661–1683)': 'tungning',
  'Qing Dynasty (1683–1895)': 'qing',
  'Japanese Colonial Era (1895–1945)': 'japanese',
  'Post-WWII & Modern Era (1945–present)': 'modern',
});

/**
 * One event on the merged timeline.
 * @typedef {Object} TimelineEvent
 * @property {string} when        year_or_era as written ("1653", "1895–1945", "2000s", "Present")
 * @property {number|null} year   parseYear(when)
 * @property {string} event_en
 * @property {string} event_zh    read with localized(ev, 'event', lang)
 * @property {Place} place        the place whose timeline it comes from
 * @property {boolean} pending    that place is still "pending owner review" (isPending)
 *
 * The events of one era, in year order.
 * @typedef {Object} TimelineEra
 * @property {string} era         one of the places' era names; '' for events that fit none
 * @property {TimelineEvent[]} events
 */

/**
 * The year an event is sorted by: the first 4-digit number, so a range by its start ("1895–1945" → 1895,
 * "2000s" → 2000); null when there is none ("Present", "17th century").
 * @param {unknown} when  year_or_era
 * @returns {number|null}
 */
export function parseYear(when) {
  const m = String(when ?? '').match(/(?<!\d)\d{4}(?!\d)/);
  return m ? Number(m[0]) : null;
}

/**
 * The years an era name covers: "Qing Dynasty (1683–1895)" → { start: 1683, end: 1895 }; "(1945–present)" ends at
 * Infinity. null for a name without years ("Prehistoric & Indigenous").
 * @param {string} name
 * @returns {{ start: number, end: number }|null}
 */
export function eraSpan(name) {
  const m = String(name ?? '').match(/(?<!\d)(\d{4})\s*[–—-]\s*(\d{4}(?!\d)|present\b)/i);
  if (!m) return null;
  return { start: Number(m[1]), end: /present/i.test(m[2]) ? Infinity : Number(m[2]) };
}

/** Lower-case words of a name, without its years: "Post-WWII & Modern Era (1945–present)" → post, wwii, modern, era. */
const words = s => String(s ?? '').replace(/\([^)]*\)/g, ' ').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !/^\d+$/.test(w));

/**
 * Which of the guide's eras an event goes under. Each era is ranked by, in turn:
 *  1. the words of the event's era_category it shares with that era's name alone ("Late Qing" → "Qing Dynasty
 *     (1683–1895)"; a word in several era names, such as "Era", does not count),
 *  2. whether the era's years hold the event's year (an undated "Present" event: an era running to the present),
 *  3. whether it is one of the place's own eras,
 *  4. the later start (a year two eras share, such as 1661, goes to the era that began then).
 * The best one wins, if 1 or 2 holds for it; otherwise the event fits no era and gets ''.
 * @param {{ year_or_era?: string, era_category?: string }} ev  a timeline entry
 * @param {string[]} placeEras  the place's eras
 * @param {string[]} eras  the guide's eras: every place's eras, each once
 * @returns {string}  one of eras, or ''
 */
export function eventEra(ev, placeEras, eras) {
  const count = new Map();
  for (const era of eras) for (const w of new Set(words(era))) count.set(w, (count.get(w) || 0) + 1);
  const said = new Set(words(ev.era_category));
  const year = parseYear(ev.year_or_era);
  const present = year === null && /\bpresent\b/i.test(String(ev.year_or_era ?? ''));
  const own = new Set(placeEras || []);
  let best = '';
  /** @type {number[]} */
  let top = [];
  for (const era of eras) {
    const span = eraSpan(era);
    const shared = [...new Set(words(era))].filter(w => said.has(w) && count.get(w) === 1).length;
    const holds = span !== null && (year !== null ? span.start <= year && year <= span.end : present && span.end === Infinity);
    const rank = [shared, holds ? 1 : 0, own.has(era) ? 1 : 0, span ? span.start : -Infinity];
    if (!top.length || later(rank, top)) { best = era; top = rank; }
  }
  return top.length && (top[0] > 0 || top[1] > 0) ? best : '';
}

/**
 * Is rank a ahead of rank b (compared item by item)?
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function later(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/**
 * Every place's timeline on one timeline. Events go under the guide's eras (eventEra); the eras come in the order of
 * their years (a name without years, Prehistoric & Indigenous, first), with the events that fit none last under ''.
 * Within an era, events by year (parseYear); undated ones such as "Present" last; equal years keep guidebook order,
 * then each place's own order. Only eras with events are listed.
 * @param {Place[]} places  guidebook order
 * @returns {TimelineEra[]}
 */
export function mergeTimeline(places) {
  const list = places || [];
  const eras = [...new Set(list.flatMap(p => (Array.isArray(p.eras) ? p.eras : [])))];
  /** @type {Map<string, TimelineEvent[]>} */
  const byEra = new Map();
  for (const p of list) {
    for (const t of Array.isArray(p.timeline) ? p.timeline : []) {
      if (!t || typeof t !== 'object') continue;
      const era = eventEra(t, p.eras, eras);
      const ev = { when: String(t.year_or_era ?? ''), year: parseYear(t.year_or_era), event_en: t.event_en || '',
        event_zh: t.event_zh || '', place: p, pending: isPending(p) };
      if (!byEra.has(era)) byEra.set(era, []);
      byEra.get(era).push(ev);
    }
  }
  const start = era => (era === '' ? Infinity : eraSpan(era)?.start ?? -Infinity);
  const byYear = (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || 0;
  return [...byEra.keys()]
    .sort((a, b) => start(a) - start(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(era => ({ era, events: [...byEra.get(era)].sort(byYear) }));
}

/**
 * An era's heading in the UI language: a schema era from lang.js (`era.<key>`), '' as "Other times", any other name
 * as written (English).
 * @param {string} era
 * @param {Lang} lang
 * @returns {string}  plain text (escape it before it goes into HTML)
 */
export function eraLabel(era, lang) {
  if (!era) return tr(lang, 'timeline.other');
  const key = ERA_KEYS[/** @type {keyof typeof ERA_KEYS} */ (era)];
  return key ? tr(lang, `era.${key}`) : era;
}
