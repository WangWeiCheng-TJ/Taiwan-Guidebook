// The full-screen "show" card (ui.js showBig): its markup around the caller's text, the speech rate of its
// 🔊 button, and keeping the screen awake while it is open. No DOM here: the browser APIs come in as arguments.

import { esc } from './util.js';
import { tr } from './lang.js';

/** Speech rate of a normal reading (ui.js speak). */
export const SAY_RATE = 0.85;
/** Speech rate when 🔊 is tapped again soon after: for a listener who did not catch it. */
export const SLOW_RATE = 0.6;
/** ms after a tap on 🔊, or after its reading ended, within which the next tap reads the same text slowly. */
export const REPEAT_MS = 5000;

/**
 * Speech rate for a tap on the card's 🔊 button: SLOW_RATE when the same text was asked for (or finished
 * reading) at most REPEAT_MS before `now`, else SAY_RATE. Every later quick tap stays slow.
 * @param {{ text: string, at: number }|null} prev  the previous tap: its text and when it was tapped or ended
 * @param {string} text
 * @param {number} now  ms, same clock as prev.at
 * @returns {number}
 */
export function sayRate(prev, text, now) {
  if (!prev || prev.text !== text) return SAY_RATE;
  const since = now - prev.at;
  return since >= 0 && since <= REPEAT_MS ? SLOW_RATE : SAY_RATE;
}

/**
 * Inner markup of #bigcard. A white panel on a dimmed backdrop (#bigcard itself: a tap there closes the
 * card, main.js); in it a bar with 🔊 (data-action="big-say", only when `say` is given and the device can
 * speak), the rotate-180° toggle (data-action="big-flip", aria-pressed) and Close (class "close",
 * data-action="close-big"); then the caller's text in `.big-text` (the part that rotates; a tap on it does
 * nothing) and a hint on how to close. Labels follow the UI language.
 * @param {string} html  trusted markup; callers must esc() any data inside
 * @param {import('./lang.js').Lang} L  UI language
 * @param {{ say?: string, canSpeak?: boolean }} [opts]  say: the Chinese the 🔊 button reads aloud
 * @returns {string}
 */
export function bigCardHtml(html, L, { say = '', canSpeak = false } = {}) {
  const sayBtn = say && canSpeak
    ? `<button class="btn big-say" type="button" data-action="big-say" data-say="${esc(say)}"><span aria-hidden="true">🔊</span> ${esc(tr(L, 'bigSay'))}</button>`
    : '';
  return `<div class="big-panel">
    <div class="big-bar">
      <span class="row">${sayBtn}<button class="btn big-flip" type="button" data-action="big-flip" aria-pressed="false"><span aria-hidden="true">↻</span> ${esc(tr(L, 'bigFlip'))}</button></span>
      <button class="btn close" type="button" data-action="close-big">${esc(tr(L, 'close'))}</button>
    </div>
    <div class="big-text">${html}</div>
    <div class="hint big-hint">${esc(tr(L, 'tapClose'))}</div>
  </div>`;
}

/**
 * @typedef {Object} WakeSentinel  a held screen wake lock (WakeLockSentinel)
 * @property {boolean} [released]
 * @property {() => Promise<void>} release
 * @property {(type: 'release', fn: () => void) => void} [addEventListener]
 */

/**
 * Keeps the screen awake while wanted (the big card is open), with the Screen Wake Lock API. The browser
 * drops the lock whenever the page is hidden: call resume() on visibilitychange to take it again. A silent
 * no-op where the API is missing or refuses (battery saver, page not visible); nothing here throws.
 * @param {() => ({ request(type: 'screen'): Promise<WakeSentinel> }|undefined|null)} getApi  e.g. () => navigator.wakeLock
 * @param {() => boolean} isVisible  e.g. () => document.visibilityState !== 'hidden'
 * @returns {{ hold(): Promise<void>, resume(): Promise<void>, release(): Promise<void>, held(): boolean }}
 *   hold: wanted from now on, take the lock; resume: take it again if still wanted and not held;
 *   release: not wanted any more, let it go; held: a lock is held right now
 */
export function wakeKeeper(getApi, isVisible) {
  let want = false;
  /** @type {WakeSentinel|null} */
  let lock = null;
  /** @type {Promise<void>|null} */
  let pending = null;
  const holding = () => !!lock && !lock.released;
  const drop = s => { try { return Promise.resolve(s.release()).catch(() => {}); } catch { return Promise.resolve(); } };

  function take() {
    if (!want || holding() || pending) return pending || Promise.resolve();
    let api;
    try { api = getApi(); } catch { api = null; }
    if (!api || typeof api.request !== 'function' || !isVisible()) return Promise.resolve();
    pending = Promise.resolve()
      .then(() => api.request('screen'))
      .then(s => {
        if (!s) return;
        if (!want) return drop(s); // the card closed while the request was pending
        lock = s;
        s.addEventListener?.('release', () => { if (lock === s) lock = null; });
      }, () => {})
      .finally(() => { pending = null; });
    return pending;
  }

  return {
    hold() { want = true; return take(); },
    resume() { return take(); },
    release() {
      want = false;
      const s = lock;
      lock = null;
      return s ? drop(s) : Promise.resolve();
    },
    held: holding,
  };
}
