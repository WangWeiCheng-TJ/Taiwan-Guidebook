import { esc, stars, today } from '../util.js';
import { dayNumber, entryName, groupByDate, placeGone } from '../triplog.js';
import { places } from '../state.js';
import { tr } from '../lang.js';
import { renderTripSection } from './trip.js';
import { renderStaySection } from './stay.js';
import { placeName } from './common.js';

/**
 * My trip tab (#/log): the plan (renderTripSection), My stay (renderStaySection), then the notes: entry form bound to s.draft
 * (an empty draft date shows today's date),
 * entries grouped by day (newest first), backup. An entry whose place the guide no longer has keeps its name
 * (entryName: the label it kept) without a link, with the "not in guidebook" badge.
 * Form: <form data-form="log"> with fields date, placeId, name, note; star buttons data-action="star" data-n
 * (aria-pressed on the one that is the rating).
 * The free-text name field ([data-other]) is hidden when a guidebook place is selected.
 * Emits: data-action="delete-entry" data-id, "export", "import" (a button: main.js clicks the hidden file input,
 * which a keyboard can't reach); data-change="import" (the file input).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderLog(s) {
  const L = s.lang;
  const dr = s.draft;
  const options = places().map(p =>
    `<option value="${esc(p.id)}" ${dr.placeId === p.id ? 'selected' : ''}>${esc(placeName(p, L))}</option>`).join('');
  const groups = groupByDate(s.log);
  const name = e => entryName(e, places(), L);
  // a place the guide dropped: its name without a link, badged like a plan's stop that is not in the guide
  const title = e => !e.placeId ? esc(name(e))
    : placeGone(e, places()) ? `${esc(name(e))} <span class="badge warm">${tr(L, 'notInGuide')}</span>`
    : `<a href="#/place/${esc(e.placeId)}">${esc(name(e))}</a>`;

  return `
    <h1>${tr(L, 'myTrip')}</h1>
    ${renderTripSection(s, today())}
    ${renderStaySection(s)}

    <h2>${tr(L, 'notes')}</h2>
    <p class="muted small">${tr(L, 'notesIntro')}</p>

    <form class="card stack" data-form="log">
      <label>${tr(L, 'date')} <input type="date" name="date" value="${esc(dr.date || today())}"></label>
      <label>${tr(L, 'where')}
        <select name="placeId">
          <option value="">${tr(L, 'elsewhere')}</option>
          ${options}
        </select>
      </label>
      <label ${dr.placeId ? 'hidden' : ''} data-other>${tr(L, 'nameLabel')}
        <input name="name" value="${esc(dr.name)}" placeholder="${esc(tr(L, 'namePh'))}">
      </label>
      <div>
        <div class="muted small">${tr(L, 'rating')}</div>
        <div class="stars" role="group" aria-label="${esc(tr(L, 'rating'))}">${[1, 2, 3, 4, 5].map(n =>
          `<button type="button" data-action="star" data-n="${n}" class="${n <= dr.stars ? 'on' : ''}" aria-label="${esc(tr(L, 'starN', { n }))}" aria-pressed="${n === dr.stars}">★</button>`).join('')}</div>
      </div>
      <label>${tr(L, 'note')} <textarea name="note" placeholder="${esc(tr(L, 'notePh'))}">${esc(dr.note)}</textarea></label>
      <button class="btn primary" type="submit">${tr(L, 'save')}</button>
    </form>

    ${groups.length ? groups.map(([date, entries]) => `
      <div class="daygroup">${esc(date)} · ${tr(L, 'dayN', { n: dayNumber(s.log, date) })}</div>
      ${entries.map(e => `<div class="card entry">
        <div>
          <div class="title">${title(e)}</div>
          ${e.stars ? `<div class="starline">${stars(e.stars)}</div>` : ''}
          ${e.note ? `<div>${esc(e.note)}</div>` : ''}
        </div>
        <button class="btn small danger" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="${esc(tr(L, 'deleteEntry', { name: name(e) }))}">✕</button>
      </div>`).join('')}
    `).join('') : `<p class="muted">${tr(L, 'nothingLogged')}</p>`}

    <h2>${tr(L, 'backup')}</h2>
    <p class="muted small">${tr(L, 'backupIntro')}</p>
    <div class="row">
      <button class="btn" type="button" data-action="export">${tr(L, 'export')}</button>
      <button class="btn" type="button" data-action="import">${tr(L, 'import')}</button>
      <input type="file" accept="application/json,.json" data-change="import" hidden>
    </div>
  `;
}
