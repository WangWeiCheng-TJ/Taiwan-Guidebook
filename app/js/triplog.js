// The personal trip log. Pure functions over LogEntry[]; persistence happens in main.js.

import { daysBetween } from './util.js';
import { placeById } from './data.js';

/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').LogDraft} LogDraft */
/** @typedef {import('./types.js').Place} Place */

export const LOG_KEY = 'tg.log.v1';
export const EXPORT_TYPE = 'taiwan-guidebook-trip-log';

/**
 * @param {string} date  YYYY-MM-DD the form should start with
 * @returns {LogDraft}
 */
export function emptyDraft(date) {
  return { date, placeId: '', name: '', stars: 0, note: '' };
}

/**
 * Why a draft cannot be saved, or null if it can.
 * Rules: needs a guidebook place or a typed name; needs a rating or a non-blank note.
 * @param {LogDraft} draft
 * @returns {string|null} user-facing message
 */
export function validateDraft(draft) {
  if (!draft.placeId && !draft.name.trim()) return 'Pick a place or type a name.';
  if (!draft.stars && !draft.note.trim()) return 'Add a rating or a note.';
  return null;
}

/**
 * @returns {string} short random id, unique enough for one person's log
 */
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Turn a valid draft into a stored entry. Trims text; name is "" when placeId is set.
 * @param {LogDraft} draft  must pass validateDraft
 * @param {string} id
 * @param {string} fallbackDate  used when draft.date is empty
 * @returns {LogEntry}
 */
export function makeEntry(draft, id, fallbackDate) {
  return {
    id,
    date: draft.date || fallbackDate,
    placeId: draft.placeId || null,
    name: draft.placeId ? '' : draft.name.trim(),
    stars: draft.stars || null,
    note: draft.note.trim(),
  };
}

/**
 * @param {LogEntry[]} log
 * @param {string} id
 * @returns {LogEntry[]} new array without that entry
 */
export function removeEntry(log, id) {
  return log.filter(e => e.id !== id);
}

/**
 * The object written to the export file.
 * @param {LogEntry[]} log
 * @param {Date} now
 * @returns {{ type: string, exported_at: string, entries: LogEntry[] }}
 */
export function exportPayload(log, now) {
  return { type: EXPORT_TYPE, exported_at: now.toISOString(), entries: log };
}

/**
 * Merge an imported file into the log. Accepts an export payload or a bare array.
 * Entries without id or date are skipped; ids already in the log are skipped (no overwrite).
 * @param {LogEntry[]} log
 * @param {unknown} parsed  JSON.parse result of the file
 * @returns {{ log: LogEntry[], added: number }}
 * @throws {Error} when the file has no entries array
 */
export function mergeImport(log, parsed) {
  const entries = Array.isArray(parsed) ? parsed : parsed && /** @type {any} */ (parsed).entries;
  if (!Array.isArray(entries)) throw new Error('Not a trip log export');
  const ids = new Set(log.map(e => e.id));
  const fresh = entries.filter(e => e && e.id && e.date && !ids.has(e.id));
  return { log: [...log, ...fresh], added: fresh.length };
}

/**
 * Earliest date in the log, taken as day 1 of the trip.
 * @param {LogEntry[]} log
 * @returns {string|null}
 */
export function firstDate(log) {
  return log.reduce((min, e) => (!min || e.date < min ? e.date : min), /** @type {string|null} */ (null));
}

/**
 * Trip day number for a date (day 1 = first logged date), or null for an empty log.
 * @param {LogEntry[]} log
 * @param {string} date
 * @returns {number|null}
 */
export function dayNumber(log, date) {
  const first = firstDate(log);
  return first ? daysBetween(first, date) + 1 : null;
}

/**
 * Display name: the guidebook name if the entry points at a known place, else the typed name.
 * @param {LogEntry} entry
 * @param {Place[]} places
 * @returns {string}
 */
export function entryName(entry, places) {
  const p = entry.placeId && placeById(places, entry.placeId);
  return p ? p.name.en : entry.name;
}

/**
 * Entries grouped by date, newest date first; entries keep insertion order within a day.
 * @param {LogEntry[]} log
 * @returns {[string, LogEntry[]][]}
 */
export function groupByDate(log) {
  /** @type {Record<string, LogEntry[]>} */
  const groups = {};
  for (const e of log) (groups[e.date] ||= []).push(e);
  return Object.keys(groups).sort().reverse().map(d => [d, groups[d]]);
}

/**
 * Entries for one place.
 * @param {LogEntry[]} log
 * @param {string} placeId
 * @returns {LogEntry[]}
 */
export function notesFor(log, placeId) {
  return log.filter(e => e.placeId === placeId);
}
