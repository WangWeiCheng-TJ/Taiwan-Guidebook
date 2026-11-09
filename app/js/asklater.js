// "Ask later": every prompt the app copies is also kept in a short list on the device, newest first, because a
// traveller often copies a question with no signal and loses it before they can paste it. Pure: no DOM, no storage.
// main.js writes ASK_LATER_KEY (device only: never in the export) and, when the browser comes back online with
// items copied offline, shows a toast and a dot on the Ask AI tab. Prompts can hold the traveller's notes, so the
// list is easy to clear.
// Contract tests: tests/core/asklater.test.js

import { clip, nowTime, today } from './util.js';
import { tr } from './lang.js';
import { PHOTO_KINDS } from './prompt.js';

/** @typedef {import('./lang.js').Lang} Lang */

export const ASK_LATER_KEY = 'tg.asklater.v1';
/** The list keeps this many items; the oldest go first. */
export const ASK_LATER_MAX = 10;
/** Items the Ask AI tab shows before "Show all". */
export const ASK_LATER_SHOWN = 3;

/**
 * Where a prompt was copied: the Ask AI tab's modes ('near', 'plan', 'photo'), "Ask AI about the menu" on a food
 * sheet ('menu'), "Copy for AI" on a place or on the timeline of all places ('place'), the select-text bar ('explain').
 * @typedef {'near'|'plan'|'photo'|'menu'|'place'|'explain'} AskLaterKind
 */
export const ASK_LATER_KINDS = /** @type {const} */ (['near', 'plan', 'photo', 'menu', 'place', 'explain']);

const SUBJECT_MAX = 40;
const WHERE_MAX = 40;

/**
 * One copied prompt.
 * @typedef {Object} AskLaterItem
 * @property {string} id
 * @property {string} at        ISO timestamp of the copy
 * @property {AskLaterKind} kind
 * @property {string} subject   what it is about, plain text as captured (the question, the area, the place or shop,
 *                              the selected text); for 'photo' a PHOTO_KINDS id, named in the UI language by laterLabel
 * @property {string} where     the city or the page it was asked from; "" when none
 * @property {string} prompt    the copied text
 * @property {boolean} waiting  copied while the browser was offline, and not copied again from the list since
 */

/** @param {unknown} s */
const oneLine = s => String(s ?? '').trim().replace(/\s+/g, ' ');

/**
 * A new item for a prompt just copied. Subject and where are put on one line and clipped to 40 characters.
 * @param {{ id: string, at: Date, kind: AskLaterKind, subject?: string, where?: string, prompt: string,
 *   offline?: boolean }} c  offline: the browser had no connection when it was copied (navigator.onLine false)
 * @returns {AskLaterItem}
 */
export function laterItem({ id, at, kind, subject = '', where = '', prompt, offline = false }) {
  return { id, at: at.toISOString(), kind, subject: clip(oneLine(subject), SUBJECT_MAX), where: clip(oneLine(where), WHERE_MAX),
    prompt, waiting: offline === true };
}

/**
 * The list with `item` first. The same prompt copied again is not kept twice: the new item replaces the old one
 * (its time and its waiting flag win). At most `max` items: the oldest are dropped.
 * @param {AskLaterItem[]} list
 * @param {AskLaterItem} item
 * @param {number} [max]
 * @returns {AskLaterItem[]}
 */
export function addLater(list, item, max = ASK_LATER_MAX) {
  return [item, ...list.filter(x => x.prompt !== item.prompt)].slice(0, Math.max(0, max));
}

/**
 * The list without the item with this id; the same array when there is none.
 * @param {AskLaterItem[]} list
 * @param {string} id
 * @returns {AskLaterItem[]}
 */
export function removeLater(list, id) {
  return list.some(x => x.id === id) ? list.filter(x => x.id !== id) : list;
}

/**
 * The list after the item with this id was copied again from the list: it is no longer waiting. Order is kept
 * (the row under the traveller's finger must not move). The same array when nothing changes.
 * @param {AskLaterItem[]} list
 * @param {string} id
 * @returns {AskLaterItem[]}
 */
export function markCopied(list, id) {
  return list.some(x => x.id === id && x.waiting) ? list.map(x => (x.id === id ? { ...x, waiting: false } : x)) : list;
}

/**
 * Items copied offline that the traveller has not copied again from the list.
 * @param {AskLaterItem[]} list
 * @returns {number}
 */
export function waitingCount(list) {
  return list.filter(x => x.waiting).length;
}

/**
 * The stored list re-validated (storage may be damaged or hand-edited): an item needs an id, a timestamp, a known
 * kind and a prompt; subject and where become one clipped line; waiting is true only when stored as true. A prompt
 * listed twice is kept once (the first, newest); at most ASK_LATER_MAX items.
 * @param {unknown} raw  readJSON(ASK_LATER_KEY, [])
 * @returns {AskLaterItem[]}
 */
export function readLater(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {AskLaterItem[]} */
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const { id, at, kind, subject, where, prompt, waiting } = /** @type {Record<string, unknown>} */ (r);
    if (typeof id !== 'string' || !id || typeof at !== 'string' || !Number.isFinite(Date.parse(at))) continue;
    if (!ASK_LATER_KINDS.includes(/** @type {any} */ (kind)) || typeof prompt !== 'string' || !prompt.trim()) continue;
    if (out.some(x => x.prompt === prompt)) continue;
    out.push({ id, at, kind: /** @type {AskLaterKind} */ (kind),
      subject: typeof subject === 'string' ? clip(oneLine(subject), SUBJECT_MAX) : '',
      where: typeof where === 'string' ? clip(oneLine(where), WHERE_MAX) : '',
      prompt, waiting: waiting === true });
    if (out.length === ASK_LATER_MAX) break;
  }
  return out;
}

/**
 * The item's short label in the UI language: "About 魁星 · Chihkan Tower", "Photo: Menu · Tainan City",
 * "Plan: Da'an District, Taipei City". The subject and the place stay as captured (a photo preset is named in `lang`).
 * @param {AskLaterItem} item
 * @param {Lang} lang
 * @returns {string}  plain text (escape it before it goes into HTML)
 */
export function laterLabel(item, lang) {
  const photo = item.kind === 'photo' && PHOTO_KINDS.includes(/** @type {any} */ (item.subject));
  const subject = photo ? tr(lang, `photo.${item.subject}`) : item.subject || '…';
  const head = tr(lang, `later.${item.kind}`, { t: subject });
  return item.where ? `${head} · ${item.where}` : head;
}

/**
 * When it was copied, in local time: "14:05" on the day of `now`, else "11/8 14:05".
 * @param {AskLaterItem} item
 * @param {Date} now
 * @returns {string}
 */
export function laterTime(item, now) {
  const at = new Date(item.at);
  const time = nowTime(at);
  if (today(at) === today(now)) return time;
  return `${at.getMonth() + 1}/${at.getDate()} ${time}`;
}
