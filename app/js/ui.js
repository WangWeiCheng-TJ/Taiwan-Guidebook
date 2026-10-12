// Small DOM side effects shared by views and main.js.

import { state } from './state.js';
import { tr } from './lang.js';

let toastTimer;

/**
 * Show a short message above the tab bar for ~2.6 s. Replaces any visible toast.
 * @param {string} msg
 * @returns {void}
 */
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
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

/**
 * Full-screen high-contrast card for showing text to a driver or shopkeeper.
 * Tapping anywhere closes it (wired in main.js). Button and hint follow the UI language at open time.
 * @param {string} html  trusted markup; callers must esc() any data inside
 * @returns {void}
 */
export function showBig(html) {
  const el = document.getElementById('bigcard');
  el.innerHTML = `<button class="btn close">${tr(state.lang, 'close')}</button>${html}<div class="hint">${tr(state.lang, 'tapClose')}</div>`;
  el.hidden = false;
}

/** @returns {void} */
export function hideBig() {
  document.getElementById('bigcard').hidden = true;
}

/**
 * Speak Chinese text with the device's TTS (works offline when a zh voice is installed).
 * Prefers a Taiwan Mandarin voice, then any other Mandarin voice. Never a Cantonese voice
 * (zh-HK / yue): it would read Mandarin phrases wrongly. With no Mandarin voice, the browser decides.
 * @param {string} text
 * @returns {void}
 */
export function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.rate = 0.85;
  const voices = speechSynthesis.getVoices();
  const norm = l => l.toLowerCase().replace('_', '-');
  const mandarin = voices.filter(v => /^(zh|cmn)/.test(norm(v.lang)) && !/^(zh-hk|zh-mo|yue)/.test(norm(v.lang)));
  const v = mandarin.find(v => norm(v.lang) === 'zh-tw') || mandarin[0];
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
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
  el.querySelector('.sheet-title').textContent = title;
  el.querySelector('.sheet-body').innerHTML = html;
  el.querySelector('.sheet-body').scrollTop = 0;
  el.hidden = false;
  document.body.classList.add('no-scroll');
}

/** @returns {void} */
export function closeSheet() {
  document.getElementById('sheet').hidden = true;
  document.body.classList.remove('no-scroll');
}
