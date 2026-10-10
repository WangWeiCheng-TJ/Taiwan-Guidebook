import { esc, clip, today } from '../util.js';
import { distanceTo, fmtKm, sortByDistance } from '../geo.js';
import { cities } from '../data.js';
import { places } from '../state.js';
import { tr, localized } from '../lang.js';
import { locationPanel, placeName } from './common.js';
import { renderTodayCard } from './trip.js';

/**
 * Explore tab (#/explore): today's plan card, location panel, city filter chips, place cards.
 * Cards are sorted by distance when s.pos is set and link to #/place/<id>.
 * A "Visited" badge shows when the log has an entry for the place.
 * Emits: data-action="city" data-city="<city_en|all>" (the filter key stays English; labels follow s.lang).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderExplore(s) {
  const L = s.lang;
  const city = s.exploreCity;
  const list = sortByDistance(places().filter(p => city === 'all' || p.location.city_en === city), s.pos);
  const visited = new Set(s.log.map(e => e.placeId).filter(Boolean));
  const cityLabel = c => {
    const p = places().find(x => x.location.city_en === c);
    return p ? localized(p.location, 'city', L) : c;
  };
  const chips = ['all', ...cities(places())].map(c =>
    `<button class="chip ${c === city ? 'on' : ''}" data-action="city" data-city="${esc(c)}">${c === 'all' ? tr(L, 'all') : esc(cityLabel(c))}</button>`
  ).join('');
  const other = L === 'en' ? 'zh_TW' : 'en';

  return `
    <h1>${tr(L, 'explore')}</h1>
    ${renderTodayCard(s, today())}
    ${locationPanel(s)}
    <div class="chips">${chips}</div>
    ${list.map(p => {
      const d = distanceTo(p, s.pos);
      return `<a class="card" href="#/place/${esc(p.id)}">
        <div class="row spread">
          <span class="title">${esc(placeName(p, L))}</span>
          ${visited.has(p.id) ? `<span class="badge">${tr(L, 'visited')}</span>` : ''}
        </div>
        <div class="meta">${esc(placeName(p, other))} · ${esc(localized(p.location, 'district', L))}, ${esc(localized(p.location, 'city', L))}${d != null ? ` · <b>${fmtKm(d)}</b>` : ''}</div>
        <p>${esc(clip(localized(p, 'summary', L), 150))}</p>
      </a>`;
    }).join('') || `<p class="muted">${tr(L, 'noPlaces')}</p>`}
  `;
}
