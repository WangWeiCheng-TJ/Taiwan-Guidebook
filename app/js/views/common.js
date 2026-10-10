// Fragments shared by several views. View contract: (state) => HTML string, no side effects.
// Interactive elements declare intent with data-action (click) / data-change / data-input,
// which main.js dispatches. Views never attach listeners themselves.

import { esc } from '../util.js';
import { places } from '../state.js';
import { placeById } from '../data.js';
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
 * "Distances from X [Update]" when a position is set,
 * otherwise "Use my location" plus a place picker as fallback.
 * Emits: data-action="locate", data-change="pick-location" (value = place id).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function locationPanel(s) {
  const L = s.lang;
  if (s.pos) {
    const picked = s.pos.placeId && placeById(places(), s.pos.placeId);
    const label = picked ? placeName(picked, L) : tr(L, 'yourLocation');
    return `<div class="panel row spread small">
      <span>${tr(L, 'distancesFrom', { label: esc(label) })}</span>
      <button class="btn small" data-action="locate">${tr(L, 'update')}</button>
    </div>`;
  }
  const options = places().map(p => `<option value="${esc(p.id)}">${esc(placeName(p, L))}</option>`).join('');
  return `<div class="panel stack small">
    <button class="btn primary" data-action="locate">⌖ ${tr(L, 'useLocation')}</button>
    <label>${tr(L, 'nearPick')}
      <select data-change="pick-location"><option value="">${tr(L, 'choosePlace')}</option>${options}</select>
    </label>
  </div>`;
}
