// TASK T1 (see docs/SPEC.md): itineraries. Pure functions except loadTrip (network).
// Implement the bodies; do not change names, parameters or return shapes.
// Contract tests: tests/tasks/trip.test.js

import { placeById } from './data.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./types.js').TripDay} TripDay */
/** @typedef {import('./types.js').TripItem} TripItem */
/** @typedef {import('./types.js').Place} Place */

export const TRIP_KEY = 'tg.trip.v1';

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
  throw new Error('TODO(T1): parseTrip');
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
  throw new Error('TODO(T1): resolveItem');
}

/**
 * @param {Trip} trip
 * @param {string} date  YYYY-MM-DD
 * @returns {TripDay|null}  the day with that date, or null
 */
export function tripDayFor(trip, date) {
  throw new Error('TODO(T1): tripDayFor');
}

/**
 * Read the itinerary URL from a query string.
 * Accepts only absolute https: URLs, so a shared link cannot point the app at http: or javascript:.
 * @param {string} search  location.search, e.g. "?trip=https%3A%2F%2Fexample.com%2Ft.json"
 * @returns {string|null}  decoded URL, or null if absent or not https
 */
export function tripUrlFrom(search) {
  throw new Error('TODO(T1): tripUrlFrom');
}

/**
 * Fetch and validate a trip. Never throws: network/HTTP/JSON problems become errors.
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ trip: Trip|null, errors: string[] }>}
 */
export async function loadTrip(url, fetchFn = fetch) {
  throw new Error('TODO(T1): loadTrip');
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
  throw new Error('TODO(T1): tripBlock');
}

// Keeps the import used until resolveItem is implemented.
void placeById;
