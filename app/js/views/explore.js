import { esc, clip } from '../util.js';
import { distanceTo, fmtKm, sortByDistance } from '../geo.js';
import { cities } from '../data.js';
import { places } from '../state.js';
import { locationPanel } from './common.js';

/**
 * Explore tab (#/explore): location panel, city filter chips, place cards.
 * Cards are sorted by distance when s.pos is set and link to #/place/<id>.
 * A "Visited" badge shows when the log has an entry for the place.
 * Emits: data-action="city" data-city="<city_en|all>".
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderExplore(s) {
  const city = s.exploreCity;
  const list = sortByDistance(places().filter(p => city === 'all' || p.location.city_en === city), s.pos);
  const visited = new Set(s.log.map(e => e.placeId).filter(Boolean));
  const chips = ['all', ...cities(places())].map(c =>
    `<button class="chip ${c === city ? 'on' : ''}" data-action="city" data-city="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`
  ).join('');

  return `
    <h1>Explore</h1>
    ${locationPanel(s)}
    <div class="chips">${chips}</div>
    ${list.map(p => {
      const d = distanceTo(p, s.pos);
      return `<a class="card" href="#/place/${esc(p.id)}">
        <div class="row spread">
          <span class="title">${esc(p.name.en)}</span>
          ${visited.has(p.id) ? '<span class="badge">Visited</span>' : ''}
        </div>
        <div class="meta">${esc(p.name.zh_TW)} · ${esc(p.location.district_en)}, ${esc(p.location.city_en)}${d != null ? ` · <b>${fmtKm(d)}</b>` : ''}</div>
        <p>${esc(clip(p.summary.en, 150))}</p>
      </a>`;
    }).join('') || '<p class="muted">No places yet.</p>'}
  `;
}
