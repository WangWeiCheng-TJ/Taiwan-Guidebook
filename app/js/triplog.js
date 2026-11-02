// The personal trip log. Pure functions over LogEntry[]; persistence happens in main.js.

import { daysBetween, isIsoDate } from './util.js';
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
 * An imported entry reshaped to the LogEntry contract, or null when it has no usable id or date.
 * The file may be hand-edited or rewritten by an AI: a rating outside 1..5 becomes null,
 * text fields that are not strings become "", and a numeric id becomes a string (so it can be deleted).
 * @param {unknown} raw
 * @returns {LogEntry|null}
 */
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (raw);
  const id = typeof e.id === 'number' && Number.isFinite(e.id) ? String(e.id) : e.id;
  if (typeof id !== 'string' || !id || !isIsoDate(e.date)) return null;
  const s = typeof e.stars === 'number' ? Math.round(e.stars) : NaN;
  return {
    id,
    date: /** @type {string} */ (e.date),
    placeId: typeof e.placeId === 'string' && e.placeId ? e.placeId : null,
    name: typeof e.name === 'string' ? e.name : '',
    stars: s >= 1 && s <= 5 ? s : null,
    note: typeof e.note === 'string' ? e.note : '',
  };
}

/**
 * Merge an imported file into the log. Accepts an export payload or a bare array.
 * Entries without an id or a real YYYY-MM-DD date are skipped; ids already in the log are skipped (no overwrite).
 * Kept entries are reshaped to the LogEntry contract (see cleanEntry): stars 1..5 or null, string text fields.
 * @param {LogEntry[]} log
 * @param {unknown} parsed  JSON.parse result of the file
 * @returns {{ log: LogEntry[], added: number }}
 * @throws {Error} when the file has no entries array
 */
export function mergeImport(log, parsed) {
  const entries = Array.isArray(parsed) ? parsed : parsed && /** @type {any} */ (parsed).entries;
  if (!Array.isArray(entries)) throw new Error('Not a trip log export');
  const ids = new Set(log.map(e => e.id));
  const fresh = entries.map(cleanEntry).filter(e => e && !ids.has(e.id));
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
