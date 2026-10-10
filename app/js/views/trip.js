import { esc } from '../util.js';
import { defaultTripDate, resolveItem, tripDayFor } from '../trip.js';
import { places } from '../state.js';
import { tr } from '../lang.js';
import { placeName } from './common.js';

/** @typedef {import('../lang.js').Lang} Lang */

/**
 * "My plan" block at the top of the My trip tab (#/log).
 * No plan, or s.pasteOpen: a box to paste the AI's answer
 *   (data-input="ai-answer", data-action="paste-plan", plus "cancel-paste" when a plan exists).
 * With a plan: title, day chips (data-action="trip-day" data-date), the chosen day's stops
 *   (guidebook stops link to #/place/<id>; unknown ids get a "not in guidebook" badge),
 *   and data-action="paste-plan-again" | "clear-trip".
 * The shown day is s.tripDate if it exists in the plan, else defaultTripDate().
 * @param {import('../state.js').AppState} s
 * @param {string} today  YYYY-MM-DD
 * @returns {string}
 */
export function renderTripSection(s, today) {
  const L = s.lang;
  if (!s.trip || s.pasteOpen) return pasteBox(!!s.trip, L);

  const trip = s.trip;
  const date = s.tripDate && tripDayFor(trip, s.tripDate) ? s.tripDate : defaultTripDate(trip, today);
  const day = tripDayFor(trip, date);
  const chips = trip.days.map(d =>
    `<button class="chip ${d.date === date ? 'on' : ''}" data-action="trip-day" data-date="${esc(d.date)}">${esc(shortDate(d.date, L))}${d.date === today ? ` · ${tr(L, 'today')}` : ''}</button>`
  ).join('');

  return `
    <div class="card plan">
      <div class="row spread">
        <span class="title">${esc(trip.title)}</span>
        <span class="muted small">${tr(L, 'days', { n: trip.days.length })}</span>
      </div>
      ${trip.days.length > 1 ? `<div class="chips" style="margin:10px 0 4px">${chips}</div>` : ''}
      ${day.title ? `<div class="daygroup" style="margin-top:8px">${esc(day.title)}</div>` : ''}
      ${day.items.length ? `<ol class="stops">${day.items.map(it => stopRow(it, L)).join('')}</ol>` : `<p class="muted small">${tr(L, 'nothingPlanned')}</p>`}
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-action="paste-plan-again">${tr(L, 'replacePlan')}</button>
        <button class="btn small danger" data-action="clear-trip">${tr(L, 'removePlan')}</button>
      </div>
    </div>`;
}

/**
 * @param {import('../types.js').TripItem} item
 * @param {Lang} L
 * @returns {string}
 */
function stopRow(item, L) {
  const { place, label, missing } = resolveItem(item, places());
  const name = place ? `<a href="#/place/${esc(place.id)}">${esc(placeName(place, L))}</a>` : esc(label);
  return `<li>
    ${item.time ? `<span class="time">${esc(item.time)}</span>` : ''}
    <span>${name}${missing ? ` <span class="badge warm">${tr(L, 'notInGuide')}</span>` : ''}</span>
    ${item.note ? `<div class="muted small">${esc(item.note)}</div>` : ''}
  </li>`;
}

/**
 * @param {boolean} hasPlan  show a Cancel button (replacing an existing plan)
 * @param {Lang} L
 * @returns {string}
 */
function pasteBox(hasPlan, L) {
  return `
    <div class="card stack">
      <div class="title">${tr(L, 'myPlan')}</div>
      <p class="muted small" style="margin:0">${tr(L, 'pasteIntro')}</p>
      <textarea data-input="ai-answer" rows="4" placeholder="${esc(tr(L, 'pastePh'))}"></textarea>
      <div class="row">
        <button class="btn primary" data-action="paste-plan">${tr(L, 'loadPlan')}</button>
        ${hasPlan ? `<button class="btn" data-action="cancel-paste">${tr(L, 'cancel')}</button>` : ''}
      </div>
    </div>`;
}

/**
 * "2026-11-04" → "Wed 4 Nov" (en) / "11月4日 週三" (zh_TW)
 * @param {string} iso
 * @param {Lang} L
 * @returns {string}
 */
function shortDate(iso, L) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString(L === 'zh_TW' ? 'zh-TW' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Compact "Today's plan" card for the top of Explore. "" when the plan has nothing for today.
 * @param {import('../state.js').AppState} s
 * @param {string} today
 * @returns {string}
 */
export function renderTodayCard(s, today) {
  const L = s.lang;
  const day = s.trip && tripDayFor(s.trip, today);
  if (!day || !day.items.length) return '';
  const stops = day.items.map(it => {
    const { place, label } = resolveItem(it, places());
    const name = place ? placeName(place, L) : label;
    return esc(it.time ? `${it.time} ${name}` : name);
  });
  return `<a class="card today" href="#/log">
    <div class="meta">${tr(L, 'todaysPlan')}${day.title ? ` · ${esc(day.title)}` : ''}</div>
    <div>${stops.join(' → ')}</div>
  </a>`;
}
