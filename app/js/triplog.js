// The personal trip log. Pure functions over LogEntry[]; persistence happens in main.js.

import { daysBetween, isIsoDate } from './util.js';
import { placeById } from './data.js';
import { localized, tr } from './lang.js';
import { t } from './i18n.js';

/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').LogDraft} LogDraft */
/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./types.js').Bilingual} Bilingual */
/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./lang.js').Lang} Lang */

export const LOG_KEY = 'tg.log.v1';
export const EXPORT_TYPE = 'taiwan-guidebook-trip-log';

/**
 * @param {string} date  YYYY-MM-DD the form should start with, or "" to follow today's date
 * @returns {LogDraft}
 */
export function emptyDraft(date) {
  return { date, placeId: '', name: '', stars: 0, note: '' };
}

/**
 * The date to keep in the draft after the user sets the form's date field. Today's date is kept as ""
 * ("follow today"), so a form left open past midnight logs the new day instead of the day the app
 * started; any other date is the user's choice and stays as picked.
 * @param {string} picked  the date input's value, YYYY-MM-DD or "" when cleared
 * @param {string} today   YYYY-MM-DD
 * @returns {string}
 */
export function draftDate(picked, today) {
  return picked === today ? '' : picked;
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
 * The place's name in both languages, as an entry keeps it (LogEntry.label).
 * @param {Place} p
 * @returns {Bilingual}
 */
function labelOf(p) {
  return { en: localized(p, 'name', 'en'), zh_TW: localized(p, 'name', 'zh_TW') };
}

/**
 * Turn a valid draft into a stored entry. Trims text; name is "" when placeId is set.
 * An entry for a place found in `places` also keeps the place's name in both languages (label), so it
 * still has one after a guide update drops the place.
 * @param {LogDraft} draft  must pass validateDraft
 * @param {string} id
 * @param {string} fallbackDate  used when draft.date is empty
 * @param {Place[]} [places]  the guidebook the place was picked from; without it, no label
 * @returns {LogEntry}
 */
export function makeEntry(draft, id, fallbackDate, places = []) {
  const p = draft.placeId ? placeById(places, draft.placeId) : null;
  return {
    id,
    date: draft.date || fallbackDate,
    placeId: draft.placeId || null,
    name: draft.placeId ? '' : draft.name.trim(),
    stars: draft.stars || null,
    note: draft.note.trim(),
    ...(p ? { label: labelOf(p) } : {}),
  };
}

/**
 * Give each entry that points at a place in `places` and has no label yet (logged before entries kept
 * one) that place's label, so it keeps its name if a later guide drops the place.
 * @param {LogEntry[]} log
 * @param {Place[]} places
 * @returns {LogEntry[]} the same array when no entry gained a label, else a new one
 */
export function withLabels(log, places) {
  let changed = false;
  const out = log.map(e => {
    const p = e.placeId && !e.label ? placeById(places, e.placeId) : null;
    if (!p) return e;
    changed = true;
    return { ...e, label: labelOf(p) };
  });
  return changed ? out : log;
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
 * An imported label reshaped to { en, zh_TW } (trimmed strings, "" for a missing one), or null when it
 * names nothing.
 * @param {unknown} raw
 * @returns {Bilingual|null}
 */
function cleanLabel(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const l = /** @type {Record<string, unknown>} */ (raw);
  const en = typeof l.en === 'string' ? l.en.trim() : '';
  const zh = typeof l.zh_TW === 'string' ? l.zh_TW.trim() : '';
  return en || zh ? { en, zh_TW: zh } : null;
}

/**
 * An imported entry reshaped to the LogEntry contract, or null when it has no usable id or date.
 * The file may be hand-edited or rewritten by an AI: a rating outside 1..5 becomes null,
 * text fields that are not strings become "", and a numeric id becomes a string (so it can be deleted).
 * A label is kept (see cleanLabel) only on an entry with a placeId; one that names nothing is dropped.
 * @param {unknown} raw
 * @returns {LogEntry|null}
 */
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (raw);
  const id = typeof e.id === 'number' && Number.isFinite(e.id) ? String(e.id) : e.id;
  if (typeof id !== 'string' || !id || !isIsoDate(e.date)) return null;
  const s = typeof e.stars === 'number' ? Math.round(e.stars) : NaN;
  const placeId = typeof e.placeId === 'string' && e.placeId ? e.placeId : null;
  const label = placeId ? cleanLabel(e.label) : null;
  return {
    id,
    date: /** @type {string} */ (e.date),
    placeId,
    name: typeof e.name === 'string' ? e.name : '',
    stars: s >= 1 && s <= 5 ? s : null,
    note: typeof e.note === 'string' ? e.note : '',
    ...(label ? { label } : {}),
  };
}

/**
 * Merge an imported file into the log. Accepts an export payload or a bare array.
 * Entries without an id or a real YYYY-MM-DD date are skipped; ids already in the log are skipped (no overwrite),
 * and so are repeats of an id earlier in the same file (the first one is kept), so ids stay unique.
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
  const fresh = entries.map(cleanEntry).filter(e => e && !ids.has(e.id) && ids.add(e.id));
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
 * Display name in a language: the guidebook name if the entry points at a known place, else the name the
 * entry kept when it was logged (label; English when it has no Chinese one), else the typed name. An entry
 * whose place is no longer in the guidebook (renamed or removed, or imported from another version) and
 * that has no label (logged before entries kept one) falls back to its placeId rather than "".
 * @param {LogEntry} entry
 * @param {Place[]} places
 * @param {Lang} [lang]  'en' by default (prompts)
 * @returns {string}
 */
export function entryName(entry, places, lang = 'en') {
  const p = entry.placeId && placeById(places, entry.placeId);
  if (p) return localized(p, 'name', lang);
  return (entry.placeId && t(entry.label, lang)) || entry.name || entry.placeId || '';
}

/**
 * True when the entry points at a place this guidebook no longer has: the log names it without a link.
 * @param {LogEntry} entry
 * @param {Place[]} places
 * @returns {boolean}
 */
export function placeGone(entry, places) {
  return !!entry.placeId && !placeById(places, entry.placeId);
}

/**
 * The guidebook places the traveller has logged or planned, each id once (log first, then the plan).
 * @param {LogEntry[]} log
 * @param {Trip|null} trip
 * @returns {string[]}
 */
export function trackedIds(log, trip) {
  const ids = [...log.map(e => e.placeId), ...(trip?.days || []).flatMap(d => (d.items || []).map(i => i.place))];
  return [...new Set(ids.filter(id => typeof id === 'string' && id))];
}

/**
 * Names of the places among `ids` that the old guidebook had and the new one has not, in the UI language,
 * taken from the old guidebook; in the order of `ids`.
 * @param {string[]} ids  e.g. trackedIds(...)
 * @param {Place[]} before  the guidebook the page had
 * @param {Place[]} after   the guidebook it has now
 * @param {Lang} lang
 * @returns {string[]}
 */
export function goneFromGuide(ids, before, after, lang) {
  return ids.flatMap(id => {
    const p = placeById(before, id);
    return p && !placeById(after, id) ? [localized(p, 'name', lang)] : [];
  });
}

/** How many gone places the guide-update message names before "and N more". */
export const GONE_NAMED = 3;

/**
 * The toast after a guide update: "Guide updated." or, when places the traveller logged or planned are
 * gone, which ones (up to GONE_NAMED names, then "and N more").
 * @param {string[]} gone  goneFromGuide(...)
 * @param {Lang} lang
 * @returns {string}
 */
export function guideUpdatedMessage(gone, lang) {
  if (!gone.length) return tr(lang, 'guideUpdated');
  const names = gone.slice(0, GONE_NAMED).join(tr(lang, 'listSep'));
  if (gone.length > GONE_NAMED) return tr(lang, 'guideGoneMore', { names, n: gone.length - GONE_NAMED });
  return tr(lang, gone.length > 1 ? 'guideGoneMany' : 'guideGone', { names });
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
