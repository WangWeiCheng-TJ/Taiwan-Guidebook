import { esc, stars } from '../util.js';
import { dayNumber, entryName, groupByDate } from '../triplog.js';
import { places } from '../state.js';

/**
 * My trip tab (#/log): entry form bound to s.draft, entries grouped by day (newest first), backup.
 * Form: <form data-form="log"> with fields date, placeId, name, note; star buttons data-action="star" data-n.
 * The free-text name field ([data-other]) is hidden when a guidebook place is selected.
 * Emits: data-action="delete-entry" data-id, "export"; data-change="import" (file input).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderLog(s) {
  const dr = s.draft;
  const options = places().map(p =>
    `<option value="${esc(p.id)}" ${dr.placeId === p.id ? 'selected' : ''}>${esc(p.name.en)}</option>`).join('');
  const groups = groupByDate(s.log);

  return `
    <h1>My trip</h1>
    <p class="muted small">Saved only on this phone. Ask AI adds these notes to your question, so it learns what you like and what you don't.</p>

    <form class="card stack" data-form="log">
      <label>Date <input type="date" name="date" value="${esc(dr.date)}"></label>
      <label>Where
        <select name="placeId">
          <option value="">Somewhere else (type below)</option>
          ${options}
        </select>
      </label>
      <label ${dr.placeId ? 'hidden' : ''} data-other>Name of the place, food, or activity
        <input name="name" value="${esc(dr.name)}" placeholder="e.g. Curry shop near Yongkang St.">
      </label>
      <div>
        <div class="muted small">Rating (optional)</div>
        <div class="stars">${[1, 2, 3, 4, 5].map(n =>
          `<button type="button" data-action="star" data-n="${n}" class="${n <= dr.stars ? 'on' : ''}" aria-label="${n} stars">★</button>`).join('')}</div>
      </div>
      <label>Note <textarea name="note" placeholder="e.g. Too salty for me. Loved the old street.">${esc(dr.note)}</textarea></label>
      <button class="btn primary" type="submit">Save</button>
    </form>

    ${groups.length ? groups.map(([date, entries]) => `
      <div class="daygroup">${esc(date)} · day ${dayNumber(s.log, date)}</div>
      ${entries.map(e => `<div class="card entry">
        <div>
          <div class="title">${e.placeId ? `<a href="#/place/${esc(e.placeId)}">${esc(entryName(e, places()))}</a>` : esc(entryName(e, places()))}</div>
          ${e.stars ? `<div class="starline">${stars(e.stars)}</div>` : ''}
          ${e.note ? `<div>${esc(e.note)}</div>` : ''}
        </div>
        <button class="btn small danger" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="Delete">✕</button>
      </div>`).join('')}
    `).join('') : '<p class="muted">Nothing logged yet.</p>'}

    <h2>Backup</h2>
    <p class="muted small">Move your notes to another phone, or keep a copy.</p>
    <div class="row">
      <button class="btn" data-action="export">Export</button>
      <label class="btn" style="color:var(--text)">Import<input type="file" accept="application/json,.json" data-change="import" hidden></label>
    </div>
  `;
}
