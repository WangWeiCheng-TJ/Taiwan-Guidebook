// Itineraries: validate, resolve against the guidebook, load from a URL, format for prompts.
// Pure functions except loadTrip (network). Contract tests: tests/core/trip.test.js

import { placeById } from './data.js';
import { isIsoDate } from './util.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./types.js').TripDay} TripDay */
/** @typedef {import('./types.js').TripItem} TripItem */
/** @typedef {import('./types.js').Place} Place */

export const TRIP_KEY = 'tg.trip.v1';

const isObj = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
// AI answers often write null for an optional key they leave out: treat it as absent.
const given = v => v !== undefined && v !== null;

function parseItem(item, errors, where) {
  if (!isObj(item)) {
    errors.push(`${where}: must be an object.`);
    return null;
  }
  const clean = {};
  for (const key of ['place', 'name']) {
    if (given(item[key])) {
      if (typeof item[key] !== 'string') errors.push(`${where}: ${key} must be text.`);
      else if (item[key].trim()) clean[key] = item[key].trim();
    }
  }
  if (!clean.place && !clean.name) {
    errors.push(`${where}: needs a place id or a name.`);
  }
  // a blank time ("" or spaces) is absent, like a blank place, name or note
  if (given(item.time) && !(typeof item.time === 'string' && !item.time.trim())) {
    let t = typeof item.time === 'string' ? item.time.trim() : '';
    if (/^\d:[0-5]\d$/.test(t)) t = `0${t}`; // "9:30" → "09:30"
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) errors.push(`${where}: time must be HH:MM, like 09:30.`);
    else clean.time = t;
  }
  if (given(item.note)) {
    if (typeof item.note !== 'string') errors.push(`${where}: note must be text.`);
    else if (item.note.trim()) clean.note = item.note.trim();
  }
  return clean;
}

function parseDay(day, errors, n) {
  const where = `Day ${n}`;
  if (!isObj(day)) {
    errors.push(`${where}: must be an object.`);
    return null;
  }
  const date = typeof day.date === 'string' ? day.date.trim() : '';
  if (!isIsoDate(date)) errors.push(`${where}: date must be YYYY-MM-DD, like 2026-11-04.`);
  if (!Array.isArray(day.items)) errors.push(`${where}: items must be a list.`);

  /** @type {TripDay} */
  const cleanDay = { date, items: [] };
  if (given(day.title)) {
    if (typeof day.title !== 'string') errors.push(`${where}: title must be text.`);
    else if (day.title.trim()) cleanDay.title = day.title.trim();
  }
  if (Array.isArray(day.items)) {
    for (const [i, it] of day.items.entries()) {
      const item = parseItem(it, errors, `${where}, stop ${i + 1}`);
      if (item) cleanDay.items.push(item);
    }
  }
  return cleanDay;
}

/**
 * Validate untrusted JSON (a file, a URL, or an AI answer) as a Trip.
 *
 * Rules, each failure adds one human-readable message to errors:
 * - raw must be an object with a non-empty string `title`
 * - `days` must be a non-empty array
 * - every day: `date` is a real calendar date written YYYY-MM-DD (not 2026-11-31); `items` is an array
 *   (may be empty); `title` optional string
 * - every item: has a non-empty string `place` or `name` (or both); `time` if present matches HH:MM
 *   (a one-digit hour such as "9:30" is accepted and padded to "09:30"); `note` if present is a string
 * - an optional field (day `title`; item `place`, `name`, `time`, `note`) set to null, or to a blank string,
 *   counts as absent
 * - unknown place ids are NOT errors here (resolveItem reports them)
 *
 * Output trip is a clean copy: only known fields kept, strings trimmed, days sorted by date.
 * Days that share a date (an AI may split one day into "Morning" and "Afternoon") become one day:
 * their items in input order, their distinct titles joined with " / ". So every date appears once
 * and tripDayFor finds all of its stops.
 *
 * @param {unknown} raw
 * @returns {{ trip: Trip|null, errors: string[] }}  trip is null when errors is non-empty
 */
export function parseTrip(raw) {
  if (!isObj(raw)) return { trip: null, errors: ['The trip must be a JSON object.'] };

  /** @type {string[]} */
  const errors = [];
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) errors.push('The trip must have a title.');
  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    errors.push('The trip must have at least one day.');
  }

  /** @type {TripDay[]} */
  const days = [];
  if (Array.isArray(raw.days)) {
    for (const [i, d] of raw.days.entries()) {
      const day = parseDay(d, errors, i + 1);
      if (day) days.push(day);
    }
  }

  if (errors.length) return { trip: null, errors };
  return { trip: { title, days: mergeSameDate(days).sort((a, b) => a.date.localeCompare(b.date)) }, errors: [] };
}

/**
 * One day per date: a later day with the same date adds its items to the first one, and its title
 * when it differs. The input days are parseTrip's own clean copies, so they may be changed.
 * @param {TripDay[]} days
 * @returns {TripDay[]}
 */
function mergeSameDate(days) {
  /** @type {Map<string, TripDay>} */
  const byDate = new Map();
  for (const day of days) {
    const first = byDate.get(day.date);
    if (!first) {
      byDate.set(day.date, day);
      continue;
    }
    first.items.push(...day.items);
    const titles = first.title ? first.title.split(' / ') : [];
    if (day.title && !titles.includes(day.title)) first.title = [...titles, day.title].join(' / ');
  }
  return [...byDate.values()];
}

/**
 * Resolve one stop against the guidebook.
 * - item.place is a known id  → { place, label: place.name.en, missing: false }
 * - item.place is unknown id  → { place: null, label: item.name || item.place, missing: true }
 * - no item.place             → { place: null, label: item.name, missing: false }
 * @param {TripItem} item
 * @param {Place[]} places
 * @returns {{ place: Place|null, label: string, missing: boolean }}
 */
export function resolveItem(item, places) {
  if (item.place) {
    const place = placeById(places, item.place);
    if (place) {
      return { place, label: place.name.en, missing: false };
    }
    return { place: null, label: item.name || item.place, missing: true };
  }
  return { place: null, label: item.name || '', missing: false };
}

/**
 * @param {Trip} trip
 * @param {string} date  YYYY-MM-DD
 * @returns {TripDay|null}  the day with that date, or null
 */
export function tripDayFor(trip, date) {
  if (!trip || !Array.isArray(trip.days)) return null;
  return trip.days.find(d => d.date === date) || null;
}

/**
 * The next stop of the plan on that date at that time, in time order: a plan may list its stops out of order
 * (an AI's afternoon half of a day before its morning half, merged by parseTrip). The next stop is a stop
 * without a time listed right after the latest stop whose time has passed (a stop is passed when its time is
 * before `time`; with none passed, an untimed first stop), else the earliest stop whose time is still ahead.
 * null when the plan has no day for the date, when that day has no timed stop (nothing tells where
 * the traveler is in it), when `time` is not HH:MM, or when every stop is behind.
 * Example: 09:00 A, B, 14:00 C at 12:00 → B; at 08:00 → A; at 15:00 → null.
 * Listed 14:00 C, 09:00 A, 11:00 B: at 10:00 → B; at 12:00 → C.
 * @param {Trip|null} trip
 * @param {Place[]} places
 * @param {string} date  YYYY-MM-DD
 * @param {string} time  HH:MM
 * @returns {{ item: TripItem, place: Place|null, label: string }|null}
 */
export function nextStop(trip, places, date, time) {
  const day = trip ? tripDayFor(trip, date) : null;
  if (!day || !/^\d\d:\d\d$/.test(String(time)) || !day.items.some(it => it.time)) return null;
  const items = day.items;
  // the latest stop that has passed (of equal times, the one listed last)
  let last = -1;
  items.forEach((it, i) => {
    if (it.time && it.time < time && (last < 0 || it.time >= /** @type {string} */ (items[last].time))) last = i;
  });
  const after = items[last + 1];
  /** @type {TripItem|null} */
  let item = after && !after.time ? after : null;
  // else the earliest stop still ahead (of equal times, the one listed first)
  if (!item) {
    for (const it of items) if (it.time && it.time >= time && (!item || it.time < /** @type {string} */ (item.time))) item = it;
  }
  if (!item) return null;
  const { place, label } = resolveItem(item, places);
  return { item, place, label };
}

/**
 * Which day to show by default: today's day, else the next upcoming day, else the last day.
 * @param {Trip} trip   days sorted by date (parseTrip guarantees this)
 * @param {string} today YYYY-MM-DD
 * @returns {string} a date that exists in the trip
 */
export function defaultTripDate(trip, today) {
  const next = trip.days.find(d => d.date >= today);
  return (next || trip.days[trip.days.length - 1]).date;
}

/**
 * Read the itinerary URL from a query string.
 * Accepts only absolute https: URLs, so a shared link cannot point the app at http: or javascript:.
 * @param {string} search  location.search, e.g. "?trip=https%3A%2F%2Fexample.com%2Ft.json"
 * @returns {string|null}  decoded URL, or null if absent or not https
 */
export function tripUrlFrom(search) {
  if (typeof search !== 'string' || !search) return null;
  try {
    const params = new URLSearchParams(search);
    const val = params.get('trip');
    if (!val) return null;
    const u = new URL(val);
    if (u.protocol === 'https:') {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch and validate a trip. Never throws: network/HTTP/JSON problems become errors.
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ trip: Trip|null, errors: string[] }>}
 */
export async function loadTrip(url, fetchFn = fetch) {
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) {
      const status = res?.status ? ` (HTTP ${res.status})` : '';
      return { trip: null, errors: [`Could not load the trip${status}.`] };
    }
    let data;
    try {
      data = await res.json();
    } catch {
      return { trip: null, errors: ['The trip file is not valid JSON.'] };
    }
    return parseTrip(data);
  } catch {
    return { trip: null, errors: ['Could not load the trip. Check your connection.'] };
  }
}

/**
 * The plan for one date as prompt text, for buildAskPrompt (wired in T3).
 * "" when the trip has no day for that date. Format:
 *   My plan for 2026-11-04 (Old Taipei):
 *   - 09:30 Dadaocheng Dihua Street Historic District, note
 *   - Curry shop
 * (time and ", note" only when present; Old Taipei = day title, omitted with its parentheses when absent)
 * @param {Trip} trip
 * @param {Place[]} places
 * @param {string} date
 * @returns {string}
 */
export function tripBlock(trip, places, date) {
  if (!trip) return '';
  const day = tripDayFor(trip, date);
  if (!day) return '';

  const header = `My plan for ${date}${day.title ? ` (${day.title})` : ''}:`;
  const lines = [header];
  for (const item of day.items || []) {
    const { label } = resolveItem(item, places);
    const timePrefix = item.time ? `${item.time} ` : '';
    const noteSuffix = item.note ? `, ${item.note}` : '';
    lines.push(`- ${timePrefix}${label}${noteSuffix}`);
  }
  return lines.join('\n');
}
