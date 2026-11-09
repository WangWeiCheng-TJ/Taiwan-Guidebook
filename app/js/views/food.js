// The owner's food picks: a section in Explore and a detail sheet.

import { esc } from '../util.js';
import { tr } from '../lang.js';
import { foodFor, foodMapsLink } from '../data.js';
import { aiLinks, sayButton } from './common.js';

export const FOOD_KINDS = ['taiwanese', 'hotpot', 'beef_noodles', 'ramen', 'japanese', 'international', 'sweets', 'bar'];

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
    const toTry = c.to_try || [];
    const groups = [['local', c.picks.filter(p => p.local)], ...FOOD_KINDS.map(k => [k, c.picks.filter(p => p.kind === k && !p.local)])]
      .filter(([k, list]) => list.length || (k === 'local' && toTry.length));
    const label = k => (k === 'local' ? localLabel(c, L) : tr(L, `food.${k}`));
    return `<details class="food" ${s.exploreCity === c.city_en ? 'open' : ''}>
      <summary>🍜 ${tr(L, 'foodPicksIn', { city: esc(name) })} <span class="muted small">(${c.picks.length})</span></summary>
      <p class="muted small">${tr(L, 'foodIntro')}</p>
      ${groups.map(([k, list]) => `
        <div class="food-kind${k === 'local' ? ' local' : ''}">${esc(label(k))}</div>
        ${list.map(p => `<button class="phrase-row" data-action="food-sheet" data-city="${esc(c.city_en)}" data-id="${esc(p.id)}">
          <span><span class="zh-inline" lang="zh-TW">${esc(p.name)}</span>${p.dish ? ` <span class="muted small">${esc(L === 'zh_TW' ? p.dish.zh_TW : p.dish.en)}</span>` : ''}</span><span class="chev" aria-hidden="true">›</span>
        </button>`).join('')}
        ${k === 'local' ? toTry.map(d => `<button class="phrase-row" data-action="dish-sheet" data-city="${esc(c.city_en)}" data-id="${esc(d.id)}">
          <span><span class="zh-inline" lang="zh-TW">${esc(d.dish.zh_TW)}</span>${L === 'zh_TW' ? '' : ` <span class="muted small">${esc(d.dish.en)}</span>`} <span class="badge warm">${tr(L, 'shopTbd')}</span></span><span class="chev" aria-hidden="true">›</span>
        </button>`).join('') : ''}`).join('')}
    </details>`;
  }).join('');
}

/**
 * Sheet body for one pick: name, kind, hint, Navigate (Google Maps search), Show to driver, and
 * "Ask AI about the menu" (data-action="ask-menu" data-city data-id data-kind="pick").
 * @param {import('../data.js').FoodCity} city
 * @param {import('../data.js').FoodPick} p
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function foodSheet(city, p, L) {
  const hint = p.hint ? (L === 'zh_TW' ? p.hint.zh_TW : p.hint.en) : '';
  return `
    <div class="big-name" lang="zh-TW">${esc(p.name)} ${sayButton(p.name, L)}</div>
    ${p.dish ? `<div class="dish">${L === 'zh_TW' ? esc(p.dish.zh_TW) : `${esc(p.dish.en)} (<span lang="zh-TW">${esc(p.dish.zh_TW)}</span>)`}</div>` : ''}
    <div class="muted">${esc(p.local ? localLabel(city, L) : tr(L, `food.${p.kind}`))} · ${esc(L === 'zh_TW' ? city.city_zh : city.city_en)}</div>
    ${hint ? `<p>${esc(hint)}</p>` : ''}
    <div class="row" style="margin-top:12px">
      <a class="btn primary" href="${esc(foodMapsLink(p, city))}" target="_blank" rel="noopener">${tr(L, 'navigate')}</a>
      <button class="btn" data-action="food-driver" data-city="${esc(city.city_en)}" data-id="${esc(p.id)}">${tr(L, 'driver')}</button>
      ${askMenuButton(city, p.id, 'pick', L)}
    </div>
    <p class="muted small">${tr(L, 'foodNoAddress')}</p>`;
}

/**
 * "Ask AI about the menu" button of a food sheet.
 * @param {import('../data.js').FoodCity} city
 * @param {string} id
 * @param {'pick'|'dish'} kind
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function askMenuButton(city, id, kind, L) {
  return `<button class="btn" data-action="ask-menu" data-city="${esc(city.city_en)}" data-id="${esc(id)}" data-kind="${kind}"><span aria-hidden="true">✦</span> ${tr(L, 'askMenu')}</button>`;
}

/**
 * What "Ask AI about the menu" tells the AI about a pick (data-kind="pick": its name, dish and hint) or a dish
 * with no shop chosen yet (data-kind="dish", a to_try entry: the dish only).
 * @param {import('../data.js').FoodCity[]|undefined} food
 * @param {string} city   city_en
 * @param {string} id
 * @param {string} kind   'pick' | 'dish'
 * @returns {import('../types.js').PhotoShop|null}  null when there is no such pick or dish
 */
export function menuShop(food, city, id, kind) {
  const c = foodFor(food, city);
  if (!c) return null;
  const where = { city_en: c.city_en, city_zh: c.city_zh };
  if (kind === 'dish') {
    const d = (c.to_try || []).find(x => x.id === id);
    return d ? { ...where, dish: d.dish } : null;
  }
  const p = c.picks.find(x => x.id === id);
  if (!p) return null;
  return { ...where, name: p.name, ...(p.dish ? { dish: p.dish } : {}), ...(p.hint ? { hint: p.hint } : {}) };
}

/**
 * Sheet body after "Ask AI about the menu" copied its prompt: whether it was copied, the next steps, links to AI
 * chats, and the prompt itself (to select by hand when copying failed).
 * @param {string} prompt
 * @param {boolean} copied
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function menuPromptSheet(prompt, copied, L) {
  return `
    ${copied ? `<p class="small">${tr(L, 'copied')}</p>` : `<p class="small muted">${tr(L, 'copyFailPreview')}</p>`}
    <p class="small">${tr(L, 'menuSteps')}</p>
    ${aiLinks(L)}
    <pre class="prompt">${esc(prompt)}</pre>`;
}

/**
 * Markup for the "Show to driver" big card of a pick: its name and city in Chinese, the request, and an
 * English gloss, each with its lang attribute (the UI around them may be English).
 * @param {import('../data.js').FoodCity} city
 * @param {import('../data.js').FoodPick} p
 * @returns {string}
 */
export function foodDriverCard(city, p) {
  return `<div class="big" lang="zh-TW">${esc(p.name)}</div>
    <div class="mid" lang="zh-TW">${esc(city.city_zh)}</div>
    <div class="mid" lang="zh-TW">請帶我到這裡，謝謝。</div>
    <div class="hint" lang="en">"Please take me here, thank you."</div>`;
}

/**
 * What the pick's driver card's 🔊 reads aloud: the shop's name, then its city (a pause between).
 * @param {import('../data.js').FoodCity} city
 * @param {import('../data.js').FoodPick} p
 * @returns {string}
 */
export function foodDriverSay(city, p) {
  return [p.name, city.city_zh].filter(Boolean).join('，');
}

/**
 * Sheet for a dish with no shop chosen yet: Navigate searches Google Maps for the dish in that city;
 * "Ask AI about the menu" (data-action="ask-menu" data-kind="dish") for when a shop is found.
 * @param {import('../data.js').FoodCity} city
 * @param {{ id: string, dish: { en: string, zh_TW: string } }} d
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function dishSheet(city, d, L) {
  const q = encodeURIComponent(`${d.dish.zh_TW} ${city.city_zh}`);
  return `
    <div class="big-name" lang="zh-TW">${esc(d.dish.zh_TW)} ${sayButton(d.dish.zh_TW, L)}</div>
    ${L === 'zh_TW' ? '' : `<div class="dish">${esc(d.dish.en)}</div>`}
    <div class="muted">${esc(localLabel(city, L))} · ${esc(L === 'zh_TW' ? city.city_zh : city.city_en)}</div>
    <p>${tr(L, 'shopTbdIntro')}</p>
    <div class="row">
      <a class="btn primary" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${tr(L, 'findNearby')}</a>
      ${askMenuButton(city, d.id, 'dish', L)}
    </div>`;
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
