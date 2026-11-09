// The backup file (export payload version 2: notes, plan, party size) and the "Last backup" line on My trip.
// Pure: no DOM, no storage. main.js writes BACKUP_KEY, shares or downloads the file and reads it back in.
// Contract tests: tests/core/backup.test.js

import { parseTrip } from './trip.js';
import { partyChosen, clampParty } from './party.js';
import { daysBetween, today } from './util.js';
import { tr } from './lang.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./lang.js').Lang} Lang */

/**
 * When the traveller last made a backup, and how many notes they saved or imported after it.
 * @typedef {Object} BackupMark
 * @property {string} at     ISO timestamp of the export
 * @property {number} since  notes saved or imported since then (0 right after a backup)
 */

export const BACKUP_KEY = 'tg.backup.v1';

/**
 * The backup file's name.
 * @param {string} date  YYYY-MM-DD, the local date of the export
 * @returns {string}
 */
export function backupFileName(date) {
  return `taiwan-trip-log-${date}.json`;
}

/**
 * The mark stored right after a backup: no notes since.
 * @param {Date} now
 * @returns {BackupMark}
 */
export function backupMark(now) {
  return { at: now.toISOString(), since: 0 };
}

/**
 * A stored mark re-validated (storage may be damaged or hand-edited): null when `at` is not a timestamp;
 * a `since` that is not a non-negative number becomes 0, a fraction is rounded down.
 * @param {unknown} raw  readJSON(BACKUP_KEY, null)
 * @returns {BackupMark|null}
 */
export function readMark(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = /** @type {Record<string, unknown>} */ (raw);
  if (typeof m.at !== 'string' || !Number.isFinite(Date.parse(m.at))) return null;
  const since = typeof m.since === 'number' && Number.isFinite(m.since) && m.since > 0 ? Math.floor(m.since) : 0;
  return { at: m.at, since };
}

/**
 * The mark after n more notes were saved or imported. No mark (never backed up) stays null: the line then
 * counts every note.
 * @param {BackupMark|null} mark
 * @param {number} n  notes added (a negative or non-number n adds nothing)
 * @returns {BackupMark|null}
 */
export function bumpMark(mark, n) {
  if (!mark) return null;
  const add = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return add ? { ...mark, since: mark.since + add } : mark;
}

/**
 * Whole local calendar days from the backup to now: 0 the same day, 1 the day after. A backup stamped in the
 * future (the clock was changed) counts as today.
 * @param {BackupMark} mark
 * @param {Date} now
 * @returns {number}
 */
export function backupAge(mark, now) {
  return Math.max(0, daysBetween(today(new Date(mark.at)), today(now)));
}

/**
 * The line on My trip: "Last backup 3 days ago · 5 notes since". Without a mark: "No backup yet · 5 notes",
 * or "" when there is nothing to back up (no notes, no plan).
 * @param {BackupMark|null|undefined} mark
 * @param {number} notes    notes in the log now
 * @param {boolean} hasPlan a plan is loaded
 * @param {Date} now
 * @param {Lang} lang
 * @returns {string}  plain text (escape it before it goes into HTML)
 */
export function backupLine(mark, notes, hasPlan, now, lang) {
  if (!mark) {
    if (!notes && !hasPlan) return '';
    const never = tr(lang, 'backup.never');
    return notes ? `${never} · ${tr(lang, notes === 1 ? 'backup.notes1' : 'backup.notesN', { n: notes })}` : never;
  }
  const age = backupAge(mark, now);
  const when = age === 0 ? tr(lang, 'backup.today') : age === 1 ? tr(lang, 'backup.yesterday') : tr(lang, 'backup.daysAgo', { n: age });
  const since = mark.since === 0 ? 'backup.since0' : mark.since === 1 ? 'backup.since1' : 'backup.sinceN';
  return `${when} · ${tr(lang, since, { n: mark.since })}`;
}

/**
 * What an imported file holds besides its notes (mergeImport reads those). A version 1 file or a bare array
 * has neither. The plan is untrusted and re-validated with parseTrip: one that fails is left out and
 * reported as badTrip. A party that is not a number is left out; one outside 1..10 is clamped.
 * @param {unknown} parsed  JSON.parse result of the file
 * @returns {{ trip: Trip|null, party: number|null, badTrip: boolean }}
 */
export function backupExtras(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { trip: null, party: null, badTrip: false };
  const p = /** @type {Record<string, unknown>} */ (parsed);
  const given = p.trip !== undefined && p.trip !== null;
  const trip = given ? parseTrip(p.trip).trip : null;
  return { trip, party: partyChosen(p.party) ? clampParty(p.party) : null, badTrip: given && !trip };
}

/**
 * What to do with a plan read from a backup file:
 * 'none' (the file has none), 'load' (no plan on the phone), 'same' (the phone already has this plan),
 * 'ask' (it would replace a different plan: main.js asks first).
 * @param {Trip|null} current   the plan on the phone
 * @param {Trip|null} incoming  backupExtras(...).trip
 * @returns {'none'|'load'|'same'|'ask'}
 */
export function planChoice(current, incoming) {
  if (!incoming) return 'none';
  if (!current) return 'load';
  return sameTrip(current, incoming) ? 'same' : 'ask';
}

/**
 * Equal plans: compared as parseTrip's clean copies, which have the same keys in the same order.
 * @param {Trip} a
 * @param {Trip} b
 * @returns {boolean}
 */
function sameTrip(a, b) {
  return JSON.stringify(parseTrip(a).trip) === JSON.stringify(parseTrip(b).trip);
}
