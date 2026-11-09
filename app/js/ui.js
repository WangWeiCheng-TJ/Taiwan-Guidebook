// Small DOM side effects shared by views and main.js.

import { state } from './state.js';
import { tr } from './lang.js';
import { SAY_RATE, sayRate, bigCardHtml, wakeKeeper } from './bigcard.js';

let toastTimer;

/**
 * Show a short message above the tab bar for ~2.6 s (or `ms`). Replaces any visible toast.
 * #toast is a status live region that always stays in the page (never hidden): screen readers announce
 * text put into it, and an empty toast takes no space (app.css .toast:empty).
 * @param {string} msg
 * @param {number} [ms]  how long it stays, for a longer message
 * @returns {void}
 */
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ''; }, ms);
}

/**
 * Copy to clipboard. Falls back to execCommand for older iOS / non-secure contexts.
 * @param {string} text
 * @returns {Promise<boolean>} true when copied
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** The screen stays awake while the big card is open (no-op where the Wake Lock API is missing). */
const wake = wakeKeeper(
  () => (typeof navigator === 'undefined' ? null : navigator.wakeLock),
  () => document.visibilityState !== 'hidden',
);
/** @type {{ text: string, at: number }|null} the card's last 🔊 tap: its text, and when tapped or done reading */
let lastSay = null;

/**
 * Full-screen high-contrast card for showing text to a driver or shopkeeper (markup: bigCardHtml): a 🔊 button
 * when `opts.say` is given and the device can speak, a rotate-180° toggle, and Close. It closes only with
 * Close, Escape, Back or a tap on the dimmed backdrop, never with a tap on the text (wired in main.js).
 * Opens upright, keeps the screen awake and the page behind from scrolling until hideBig. Labels and the
 * dialog's accessible name follow the UI language at open time.
 * @param {string} html  trusted markup; callers must esc() any data inside
 * @param {{ say?: string }} [opts]  say: the Chinese the 🔊 button reads aloud (sayOnCard)
 * @returns {void}
 */
export function showBig(html, opts = {}) {
  const el = document.getElementById('bigcard');
  el.setAttribute('aria-label', tr(state.lang, 'bigCard'));
  el.innerHTML = bigCardHtml(html, state.lang, { say: opts.say || '', canSpeak: typeof speechSynthesis !== 'undefined' });
  el.classList.remove('flipped');
  el.hidden = false;
  document.body.classList.add('no-scroll'); // a wheel or swipe on the dimmed backdrop must not scroll the page behind
  lastSay = null;
  wake.hold();
}

/**
 * Close the big card, stop its 🔊 reading and let the screen sleep again. Stopping every reading is safe: the
 * card is modal, so nothing else can have started one while it was open.
 * @returns {void}
 */
export function hideBig() {
  document.getElementById('bigcard').hidden = true;
  if (document.getElementById('sheet').hidden) document.body.classList.remove('no-scroll'); // a sheet under it still locks the page
  wake.release();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  lastSay = null;
}

/**
 * The page is visible again (visibilitychange): the browser dropped the wake lock while it was hidden, so
 * take it again if the big card is still open. Otherwise nothing.
 * @returns {void}
 */
export function wakeAgain() {
  wake.resume();
}

/**
 * Turn the big card's text 180° (or back), so the person opposite can read it; the buttons stay upright.
 * @returns {boolean} true when the text is now turned
 */
export function flipBig() {
  return document.getElementById('bigcard').classList.toggle('flipped');
}

/**
 * The big card's 🔊: read the text aloud. A tap within REPEAT_MS of the previous one, or of the end of its
 * reading, reads it again more slowly (sayRate).
 * @param {string} text  Chinese
 * @returns {void}
 */
export function sayOnCard(text) {
  const now = Date.now();
  const said = { text, at: now };
  const u = utter(text, sayRate(lastSay, text, now));
  lastSay = said;
  u.onend = () => { said.at = Date.now(); }; // "again" also counts from the end of a long reading
}

/**
 * Speak Chinese text with the device's TTS (works offline when a zh voice is installed).
 * Prefers a Taiwan Mandarin voice, then any other Mandarin voice. Never a Cantonese voice
 * (zh-HK / yue): it would read Mandarin phrases wrongly. With no Mandarin voice, the browser decides.
 * @param {string} text
 * @param {number} [rate]  speech rate, SAY_RATE by default
 * @returns {void}
 */
export function speak(text, rate = SAY_RATE) {
  utter(text, rate);
}

/**
 * speak(), returning the utterance. Stops whatever was being read.
 * @param {string} text
 * @param {number} rate
 * @returns {SpeechSynthesisUtterance}
 */
function utter(text, rate) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.rate = rate;
  const voices = speechSynthesis.getVoices();
  const norm = l => l.toLowerCase().replace('_', '-');
  const mandarin = voices.filter(v => /^(zh|cmn)/.test(norm(v.lang)) && !/^(zh-hk|zh-mo|yue)/.test(norm(v.lang)));
  const v = mandarin.find(v => norm(v.lang) === 'zh-tw') || mandarin[0];
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return u;
}

/**
 * Bottom sheet over the current page: keeps the page and its scroll position underneath.
 * Clicks inside are dispatched by main.js like clicks in #view.
 * @param {string} title  plain text
 * @param {string} html   trusted markup; callers must esc() any data inside
 * @returns {void}
 */
export function openSheet(title, html) {
  const el = document.getElementById('sheet');
  el.querySelector('.sheet-head button').setAttribute('aria-label', tr(state.lang, 'close'));
  el.querySelector('.sheet-title').textContent = title;
  el.querySelector('.sheet-body').innerHTML = html;
  el.querySelector('.sheet-body').scrollTop = 0;
  el.hidden = false;
  document.body.classList.add('no-scroll');
}

/** @returns {void} */
export function closeSheet() {
  document.getElementById('sheet').hidden = true;
  if (document.getElementById('bigcard').hidden) document.body.classList.remove('no-scroll');
}
