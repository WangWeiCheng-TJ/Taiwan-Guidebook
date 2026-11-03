// Fragments shared by several views. View contract: (state) => HTML string, no side effects.
// Interactive elements declare intent with data-action (click) / data-change / data-input,
// which main.js dispatches. Views never attach listeners themselves.

import { esc } from '../util.js';
import { places } from '../state.js';
import { cities } from '../data.js';
import { tr, localized } from '../lang.js';

/**
 * BCP 47 tag for a lang="" attribute, so screen readers use the right voice (and browsers the right CJK
 * glyphs) for text in the language other than the UI's.
 * @param {import('../lang.js').Lang} lang
 * @returns {'zh-TW'|'en'}
 */
export function langTag(lang) {
  return lang === 'zh_TW' ? 'zh-TW' : 'en';
}

/**
 * Place name in the UI language.
 * @param {import('../types.js').Place} p
 * @param {import('../lang.js').Lang} lang
 * @returns {string}
 */
export function placeName(p, lang) {
  return localized(p, 'name', lang);
}

/**
 * City name in the UI language, looked up from any guidebook place in that city.
 * @param {string} city  city_en
 * @param {import('../lang.js').Lang} lang
 * @returns {string}
 */
export function cityName(city, lang) {
  const p = places().find(x => x.location.city_en === city);
  return p ? localized(p.location, 'city', lang) : city;
}

/**
 * "Distances from your location [Update]" with GPS, "I'm in <city> [Change] [Use my location]" with a picked
 * city (no distances then, see gpsDistance), otherwise "Use my location" plus a city picker as fallback
 * (fewer options than listing places).
 * Emits: data-action="locate" | "clear-location", data-change="pick-location" (value = city_en).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function locationPanel(s) {
  const L = s.lang;
  if (s.pos) {
    const label = s.pos.city ? cityName(s.pos.city, L) : tr(L, 'yourLocation');
    return `<div class="panel row spread small">
      <span>${tr(L, s.pos.city ? 'inCity' : 'distancesFrom', { label: esc(label) })}</span>
      <span class="row">
        ${s.pos.city ? `<button class="btn small" data-action="clear-location">${tr(L, 'change')}</button>` : ''}
        <button class="btn small" data-action="locate">${tr(L, s.pos.city ? 'useLocation' : 'update')}</button>
      </span>
    </div>`;
  }
  const options = cities(places()).map(c => `<option value="${esc(c)}">${esc(cityName(c, L))}</option>`).join('');
  return `<div class="panel stack small">
    <button class="btn primary" data-action="locate">⌖ ${tr(L, 'useLocation')}</button>
    <label>${tr(L, 'nearPick')}
      <select data-change="pick-location"><option value="">${tr(L, 'choosePlace')}</option>${options}</select>
    </label>
  </div>`;
}

/**
 * "Then open: ChatGPT Claude Gemini": links to the AI chats a copied prompt is pasted into.
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function aiLinks(L) {
  return `<div class="row small">
    <span class="muted">${tr(L, 'thenOpen')}</span>
    <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
    <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
    <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
  </div>`;
}

/**
 * 🔊 button that reads Chinese text aloud with the device voice (data-action="say").
 * "" on devices without speech synthesis, so no dead button is shown.
 * @param {string} text  Chinese text to speak
 * @param {import('../lang.js').Lang} lang  UI language, for the button's accessible label
 * @returns {string}
 */
export function sayButton(text, lang) {
  if (typeof speechSynthesis === 'undefined' || !text) return '';
  return `<button class="say-btn" type="button" data-action="say" data-say="${esc(text)}" aria-label="${esc(tr(lang, 'listen'))}" title="${esc(tr(lang, 'listen'))}">🔊</button>`;
}
