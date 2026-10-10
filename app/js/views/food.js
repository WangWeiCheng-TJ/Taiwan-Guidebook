// The owner's food picks: a section in Explore and a detail sheet.

import { esc } from '../util.js';
import { tr } from '../lang.js';
import { foodFor, foodMapsLink } from '../data.js';

export const FOOD_KINDS = ['taiwanese', 'beef_noodles', 'ramen', 'japanese', 'international', 'sweets', 'bar'];

/**
 * Explore section: one collapsible block per city that has picks, open when Explore is filtered to that city.
 * Rows emit data-action="food-sheet" data-city data-id.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderFoodSection(s) {
  const L = s.lang;
  const cities = (s.data.food || []).filter(c => s.exploreCity === 'all' || c.city_en === s.exploreCity);
  return cities.map(c => {
    const name = L === 'zh_TW' ? c.city_zh : c.city_en;
    // Local specialties first, then by kind; a pick appears once.
    const groups = [['local', c.picks.filter(p => p.local)], ...FOOD_KINDS.map(k => [k, c.picks.filter(p => p.kind === k && !p.local)])]
      .filter(([, list]) => list.length);
    const label = k => (k === 'local' ? localLabel(c, L) : tr(L, `food.${k}`));
    return `<details class="food" ${s.exploreCity === c.city_en ? 'open' : ''}>
      <summary>🍜 ${tr(L, 'foodPicksIn', { city: esc(name) })} <span class="muted small">(${c.picks.length})</span></summary>
      <p class="muted small">${tr(L, 'foodIntro')}</p>
      ${groups.map(([k, list]) => `
        <div class="food-kind${k === 'local' ? ' local' : ''}">${esc(label(k))}</div>
        ${list.map(p => `<button class="phrase-row" data-action="food-sheet" data-city="${esc(c.city_en)}" data-id="${esc(p.id)}">
          <span><span class="zh-inline" lang="zh-TW">${esc(p.name)}</span>${p.dish ? ` <span class="muted small">${esc(L === 'zh_TW' ? p.dish.zh_TW : p.dish.en)}</span>` : ''}</span><span class="chev" aria-hidden="true">›</span>
        </button>`).join('')}`).join('')}
    </details>`;
  }).join('');
}

/**
 * Sheet body for one pick: name, kind, hint, Navigate (Google Maps search) and Show to driver.
 * @param {import('../data.js').FoodCity} city
 * @param {import('../data.js').FoodPick} p
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function foodSheet(city, p, L) {
  const hint = p.hint ? (L === 'zh_TW' ? p.hint.zh_TW : p.hint.en) : '';
  return `
    <div class="big-name" lang="zh-TW">${esc(p.name)}</div>
    ${p.dish ? `<div class="dish">${esc(L === 'zh_TW' ? p.dish.zh_TW : `${p.dish.en} (${p.dish.zh_TW})`)}</div>` : ''}
    <div class="muted">${esc(p.local ? localLabel(city, L) : tr(L, `food.${p.kind}`))} · ${esc(L === 'zh_TW' ? city.city_zh : city.city_en)}</div>
    ${hint ? `<p>${esc(hint)}</p>` : ''}
    <div class="row" style="margin-top:12px">
      <a class="btn primary" href="${esc(foodMapsLink(p, city))}" target="_blank" rel="noopener">${tr(L, 'navigate')}</a>
      <button class="btn" data-action="food-driver" data-city="${esc(city.city_en)}" data-id="${esc(p.id)}">${tr(L, 'driver')}</button>
    </div>
    <p class="muted small">${tr(L, 'foodNoAddress')}</p>`;
}

/**
 * Label of the local-specialties group, e.g. "Tainan specialties" / "台南特色".
 * @param {import('../data.js').FoodCity} city
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function localLabel(city, L) {
  return city.local_label ? (L === 'zh_TW' ? city.local_label.zh_TW : city.local_label.en) : tr(L, 'food.local');
}

/**
 * Find a pick by city and id.
 * @param {import('../data.js').FoodCity[]|undefined} food
 * @param {string} city
 * @param {string} id
 * @returns {{ city: import('../data.js').FoodCity, pick: import('../data.js').FoodPick }|null}
 */
export function findPick(food, city, id) {
  const c = foodFor(food, city);
  const pick = c && c.picks.find(p => p.id === id);
  return pick ? { city: c, pick } : null;
}
