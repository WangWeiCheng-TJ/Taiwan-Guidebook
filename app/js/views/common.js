// Fragments shared by several views. View contract: (state) => HTML string, no side effects.
// Interactive elements declare intent with data-action (click) / data-change / data-input,
// which main.js dispatches. Views never attach listeners themselves.

import { esc } from '../util.js';
import { places } from '../state.js';
import { cities } from '../data.js';
import { tr, localized } from '../lang.js';

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
 * "Distances from X [Update]" when a position is set,
 * otherwise "Use my location" plus a city picker as fallback (fewer options than listing places).
 * Emits: data-action="locate" | "clear-location", data-change="pick-location" (value = city_en).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function locationPanel(s) {
  const L = s.lang;
  if (s.pos) {
    const label = s.pos.city ? cityName(s.pos.city, L) : tr(L, 'yourLocation');
    return `<div class="panel row spread small">
      <span>${tr(L, 'distancesFrom', { label: esc(label) })}</span>
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
