import { esc } from '../util.js';
import { defaultTripDate, resolveItem, tripDayFor } from '../trip.js';
import { places } from '../state.js';

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
  if (!s.trip || s.pasteOpen) return pasteBox(!!s.trip);

  const trip = s.trip;
  const date = s.tripDate && tripDayFor(trip, s.tripDate) ? s.tripDate : defaultTripDate(trip, today);
  const day = tripDayFor(trip, date);
  const chips = trip.days.map(d =>
    `<button class="chip ${d.date === date ? 'on' : ''}" data-action="trip-day" data-date="${esc(d.date)}">${esc(shortDate(d.date))}${d.date === today ? ' · today' : ''}</button>`
  ).join('');

  return `
    <div class="card plan">
      <div class="row spread">
        <span class="title">${esc(trip.title)}</span>
        <span class="muted small">${trip.days.length} day${trip.days.length === 1 ? '' : 's'}</span>
      </div>
      ${trip.days.length > 1 ? `<div class="chips" style="margin:10px 0 4px">${chips}</div>` : ''}
      <div class="daygroup" style="margin-top:8px">${esc(date)}${day.title ? ` · ${esc(day.title)}` : ''}</div>
      ${day.items.length ? `<ol class="stops">${day.items.map(stopRow).join('')}</ol>` : '<p class="muted small">Nothing planned for this day.</p>'}
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-action="paste-plan-again">Replace plan</button>
        <button class="btn small danger" data-action="clear-trip">Remove plan</button>
      </div>
    </div>`;
}

/**
 * @param {import('../types.js').TripItem} item
 * @returns {string}
 */
function stopRow(item) {
  const { place, label, missing } = resolveItem(item, places());
  const name = place ? `<a href="#/place/${esc(place.id)}">${esc(label)}</a>` : esc(label);
  return `<li>
    ${item.time ? `<span class="time">${esc(item.time)}</span>` : ''}
    <span>${name}${missing ? ' <span class="badge warm">not in guidebook</span>' : ''}</span>
    ${item.note ? `<div class="muted small">${esc(item.note)}</div>` : ''}
  </li>`;
}

/**
 * @param {boolean} hasPlan  show a Cancel button (replacing an existing plan)
 * @returns {string}
 */
function pasteBox(hasPlan) {
  return `
    <div class="card stack">
      <div class="title">My plan</div>
      <p class="muted small" style="margin:0">In <a href="#/ask">Ask AI</a>, tick <b>Ask for a plan I can paste back</b>, send it to your AI, then paste its whole answer here.</p>
      <textarea data-input="ai-answer" rows="4" placeholder="Paste the AI's answer here"></textarea>
      <div class="row">
        <button class="btn primary" data-action="paste-plan">Load plan</button>
        ${hasPlan ? '<button class="btn" data-action="cancel-paste">Cancel</button>' : ''}
      </div>
    </div>`;
}

/**
 * "2026-11-04" → "Wed 4 Nov"
 * @param {string} iso
 * @returns {string}
 */
function shortDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Compact "Today's plan" card for the top of Explore. "" when the plan has nothing for today.
 * @param {import('../state.js').AppState} s
 * @param {string} today
 * @returns {string}
 */
export function renderTodayCard(s, today) {
  const day = s.trip && tripDayFor(s.trip, today);
  if (!day || !day.items.length) return '';
  const stops = day.items.map(it => {
    const { label } = resolveItem(it, places());
    return esc(it.time ? `${it.time} ${label}` : label);
  });
  return `<a class="card today" href="#/log">
    <div class="meta">Today's plan${day.title ? ` · ${esc(day.title)}` : ''}</div>
    <div>${stops.join(' → ')}</div>
  </a>`;
}
