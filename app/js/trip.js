// Itineraries: validate, resolve against the guidebook, load from a URL, format for prompts.
// Pure functions except loadTrip (network). Contract tests: tests/tasks/trip.test.js

import { placeById } from './data.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./types.js').TripDay} TripDay */
/** @typedef {import('./types.js').TripItem} TripItem */
/** @typedef {import('./types.js').Place} Place */

export const TRIP_KEY = 'tg.trip.v1';

const isObj = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));

function parseItem(item, errors, where) {
  if (!isObj(item)) {
    errors.push(`${where}: must be an object.`);
    return null;
  }
  const clean = {};
  for (const key of ['place', 'name']) {
    if (item[key] !== undefined) {
      if (typeof item[key] !== 'string') errors.push(`${where}: ${key} must be text.`);
      else if (item[key].trim()) clean[key] = item[key].trim();
    }
  }
  if (!clean.place && !clean.name) {
    errors.push(`${where}: needs a place id or a name.`);
  }
  if (item.time !== undefined) {
    const t = typeof item.time === 'string' ? item.time.trim() : '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) errors.push(`${where}: time must be HH:MM, like 09:30.`);
    else clean.time = t;
  }
  if (item.note !== undefined) {
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`${where}: date must be YYYY-MM-DD, like 2026-11-04.`);
  if (!Array.isArray(day.items)) errors.push(`${where}: items must be a list.`);

  /** @type {TripDay} */
  const cleanDay = { date, items: [] };
  if (day.title !== undefined) {
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
 * - every day: `date` matches YYYY-MM-DD; `items` is an array (may be empty); `title` optional string
 * - every item: has a non-empty string `place` or `name` (or both); `time` if present matches HH:MM;
 *   `note` if present is a string
 * - unknown place ids are NOT errors here (resolveItem reports them)
 *
 * Output trip is a clean copy: only known fields kept, strings trimmed, days sorted by date.
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
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { trip: { title, days }, errors: [] };
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
