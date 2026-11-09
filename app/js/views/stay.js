import { esc } from '../util.js';
import { cities } from '../data.js';
import { places } from '../state.js';
import { tr } from '../lang.js';
import { stayHere, stayCity, telHref, emptyStay } from '../stay.js';
import { cityName } from './common.js';

/** @typedef {import('../types.js').Stay} Stay */
/** @typedef {import('../lang.js').Lang} Lang */

// Everything here carries data-private: main.js keeps the select-text "Ask AI" bar off it, so the stay
// never reaches a prompt that way either.

/**
 * "My stay" on My trip (#/log): the saved stays, each with "Take me back" (data-action="stay-card"),
 * "Edit" (data-action="stay-edit") and "Remove" (data-action="stay-remove"), all with data-id; then the form,
 * shown when there is no stay yet or s.stayOpen, else data-action="stay-add". The form is
 * <form data-form="stay"> bound to s.stayDraft, with fields name, address, phone, city (a guidebook city_en,
 * or "" for none) and, when a stay is saved, data-action="stay-cancel". Says the stay stays on the device.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderStaySection(s) {
  const L = s.lang;
  const stays = s.stays || []; // a state built before My stay existed (tests) has none
  const open = s.stayOpen || !stays.length;
  return `
    <h2>${tr(L, 'stay.title')}</h2>
    <p class="muted small">${tr(L, 'stay.intro')}</p>
    ${stays.map(st => stayRow(st, L)).join('')}
    ${open ? stayForm(L, s.stayDraft || emptyStay(), stays.length > 0) : `<button class="btn" type="button" data-action="stay-add">${tr(L, 'stay.add')}</button>`}`;
}

/**
 * One saved stay on My trip.
 * @param {Stay} st
 * @param {Lang} L
 * @returns {string}
 */
function stayRow(st, L) {
  const city = stayCity(st, places());
  const tel = telHref(st.phone);
  return `<div class="card" data-private>
      <div class="row spread">
        <span class="title" lang="zh-TW">${esc(st.name)}</span>
        ${city ? `<span class="badge">${esc(cityName(city, L))}</span>` : ''}
      </div>
      <div lang="zh-TW">${esc(st.address)}</div>
      ${tel ? `<div class="small"><a href="${esc(tel)}">${esc(st.phone)}</a></div>` : ''}
      <div class="row" style="margin-top:10px">
        <button class="btn small primary" data-action="stay-card" data-id="${esc(st.id)}" aria-label="${esc(tr(L, 'stay.backTo', { name: st.name }))}">${tr(L, 'stay.back')}</button>
        <button class="btn small" data-action="stay-edit" data-id="${esc(st.id)}" aria-label="${esc(tr(L, 'stay.editLabel', { name: st.name }))}">${tr(L, 'stay.edit')}</button>
        <button class="btn small danger" data-action="stay-remove" data-id="${esc(st.id)}" aria-label="${esc(tr(L, 'stay.removeLabel', { name: st.name }))}">${tr(L, 'stay.remove')}</button>
      </div>
    </div>`;
}

/**
 * The add / edit form, holding the draft.
 * @param {Lang} L
 * @param {Stay} d  s.stayDraft
 * @param {boolean} canCancel  a stay is saved: the form can close without saving
 * @returns {string}
 */
function stayForm(L, d, canCancel) {
  const known = cities(places());
  const list = d.city && !known.includes(d.city) ? [...known, d.city] : known;
  const options = list.map(c => `<option value="${esc(c)}" ${d.city === c ? 'selected' : ''}>${esc(cityName(c, L))}</option>`).join('');
  return `<form class="card stack" data-form="stay" data-private>
      <label>${tr(L, 'stay.name')}
        <input name="name" lang="zh-TW" autocomplete="off" value="${esc(d.name)}" placeholder="${esc(tr(L, 'stay.namePh'))}">
      </label>
      <label>${tr(L, 'stay.address')}
        <textarea name="address" lang="zh-TW" rows="2" placeholder="${esc(tr(L, 'stay.addressPh'))}">${esc(d.address)}</textarea>
      </label>
      <label>${tr(L, 'stay.phone')}
        <input name="phone" type="tel" autocomplete="off" value="${esc(d.phone)}" placeholder="${esc(tr(L, 'stay.phonePh'))}">
      </label>
      <label>${tr(L, 'stay.city')}
        <select name="city"><option value="">${tr(L, 'stay.cityNone')}</option>${options}</select>
      </label>
      <div class="row">
        <button class="btn primary" type="submit">${tr(L, 'stay.save')}</button>
        ${canCancel ? `<button class="btn" type="button" data-action="stay-cancel">${tr(L, 'cancel')}</button>` : ''}
      </div>
    </form>`;
}

/**
 * Explore's "Take me back" row for the stay stayHere picks (the only one, the one in the picked city, or the
 * nearest to the position). "" when there is none. Emits data-action="stay-card" data-id.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function stayHereRow(s) {
  const st = stayHere(s.stays || [], s.pos, places());
  if (!st) return '';
  const L = s.lang;
  return `<div class="panel row spread" data-private>
      <span class="small">${tr(L, 'stay.yours', { name: `<b lang="zh-TW">${esc(st.name)}</b>` })}</span>
      <button class="btn small primary" data-action="stay-card" data-id="${esc(st.id)}" aria-label="${esc(tr(L, 'stay.backTo', { name: st.name }))}">${tr(L, 'stay.back')}</button>
    </div>`;
}

/**
 * Markup for the stay's show card, in the driver card's layout (place.js driverCard): the name big, the
 * Chinese address, 請帶我到這裡，謝謝。 and its English gloss; then the phone as a tel: link, for the driver
 * to call the hotel. Always Chinese: it is shown to a local.
 * @param {Stay} st
 * @returns {string}
 */
export function stayCard(st) {
  const tel = telHref(st.phone);
  return `<div class="big" lang="zh-TW">${esc(st.name)}</div>
    <div class="mid" lang="zh-TW">${esc(st.address)}</div>
    <div class="mid" lang="zh-TW">請帶我到這裡，謝謝。</div>
    <div class="hint" lang="en">"Please take me here, thank you."</div>
    ${tel ? `<div class="mid" lang="zh-TW">電話 <a href="${esc(tel)}">${esc(st.phone)}</a></div>` : ''}`;
}
