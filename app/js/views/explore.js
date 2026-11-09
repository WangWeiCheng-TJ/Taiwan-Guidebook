import { esc, clip, today } from '../util.js';
import { gpsDistance, fmtKm, sortByDistance } from '../geo.js';
import { cities } from '../data.js';
import { places } from '../state.js';
import { tr, localized } from '../lang.js';
import { locationPanel, placeName, langTag } from './common.js';
import { renderTodayCard } from './trip.js';
import { stayHereRow } from './stay.js';
import { renderFoodSection } from './food.js';

/**
 * Explore tab (#/explore): today's plan card, "Take me back" to the stay here (stayHereRow), location panel,
 * city filter chips, place cards.
 * Cards are sorted by distance when s.pos is set and link to #/place/<id>. They show the distance only from
 * GPS (gpsDistance). A picked city is no one's position: its own places come first, then the others by
 * distance from its centre.
 * A "Visited" badge shows when the log has an entry for the place.
 * Emits: data-action="city" data-city="<city_en|all>" (the filter key stays English; labels follow s.lang).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderExplore(s) {
  const L = s.lang;
  const city = s.exploreCity;
  const sorted = sortByDistance(places().filter(p => city === 'all' || p.location.city_en === city), s.pos);
  const picked = s.pos?.source === 'pick' ? s.pos.city : null;
  const list = picked
    ? [...sorted.filter(p => p.location.city_en === picked), ...sorted.filter(p => p.location.city_en !== picked)]
    : sorted;
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
    ${stayHereRow(s)}
    ${locationPanel(s)}
    <div class="chips">${chips}</div>
    ${list.map(p => {
      const d = gpsDistance(p, s.pos);
      return `<a class="card" href="#/place/${esc(p.id)}">
        <div class="row spread">
          <span class="title">${esc(placeName(p, L))}</span>
          ${visited.has(p.id) ? `<span class="badge">${tr(L, 'visited')}</span>` : ''}
        </div>
        <div class="meta"><span lang="${langTag(other)}">${esc(placeName(p, other))}</span> · ${esc(localized(p.location, 'district', L))}, ${esc(localized(p.location, 'city', L))}${d != null ? ` · <b>${fmtKm(d)}</b>` : ''}</div>
        <p>${esc(clip(localized(p, 'summary', L), 150))}</p>
      </a>`;
    }).join('') || `<p class="muted">${tr(L, 'noPlaces')}</p>`}
    ${renderFoodSection(s)}
  `;
}
