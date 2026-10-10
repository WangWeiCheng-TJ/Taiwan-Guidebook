import { esc, stars } from '../util.js';
import { distanceTo, fmtKm, mapsLinks } from '../geo.js';
import { placeById } from '../data.js';
import { notesFor } from '../triplog.js';
import { places } from '../state.js';
import { tr, localized, localizedList } from '../lang.js';
import { placeName } from './common.js';

/**
 * Place page (#/place/<id>): header, badges, summary, action buttons, the user's notes,
 * practical sections, then the story and timeline collapsed. Content follows s.lang (falls back to English).
 * Emits: data-action="driver" | "copy-place" (data-id = place id).
 * Links: Google Maps directions, Apple Maps, #/log/<id> ("I was here" prefills the log form).
 * @param {import('../state.js').AppState} s
 * @param {string} id  place id from the route
 * @returns {string}
 */
export function renderPlace(s, id) {
  const L = s.lang;
  const p = placeById(places(), id);
  if (!p) return `<p>${tr(L, 'notFound')} <a href="#/explore">${tr(L, 'back')}</a></p>`;
  const g = p.foreign_visitor_guide || {};
  const c = p.cultural_significance || {};
  const d = distanceTo(p, s.pos);
  const links = mapsLinks(p);
  const notes = notesFor(s.log, p.id);
  const mustSee = localizedList(g, 'must_see_spots', L);
  const etiquette = localized(g, 'etiquette_tips', L);
  const bestTime = localized(g, 'best_time_to_visit', L);
  const transport = localized(g, 'transportation', L);
  const why = localized(c, 'why_it_matters', L);
  const look = localized(c, 'architectural_highlights', L);

  return `
    <a href="#/explore" class="small">${tr(L, 'allPlaces')}</a>
    <h1>${esc(placeName(p, L))}</h1>
    <div class="zh">${esc(placeName(p, L === 'en' ? 'zh_TW' : 'en'))}</div>
    <div class="muted small">${esc(localized(p.location, 'district', L))}, ${esc(localized(p.location, 'city', L))}${d != null ? ` · ${tr(L, 'away', { d: fmtKm(d) })}` : ''}</div>
    <div class="row" style="margin:10px 0">
      ${p.heritage_status ? `<span class="badge">${esc(p.heritage_status)}</span>` : ''}
      ${p.established_year ? `<span class="badge warm">${tr(L, 'since', { y: esc(p.established_year) })}</span>` : ''}
      ${g.recommended_duration_min ? `<span class="badge warm">${tr(L, 'minutes', { n: esc(g.recommended_duration_min) })}</span>` : ''}
    </div>
    <p>${esc(localized(p, 'summary', L))}</p>

    <div class="row">
      <a class="btn primary" href="${esc(links.google)}" target="_blank" rel="noopener">${tr(L, 'navigate')}</a>
      <button class="btn" data-action="driver" data-id="${esc(p.id)}">${tr(L, 'driver')}</button>
      <a class="btn" href="#/log/${esc(p.id)}">${tr(L, 'wasHere')}</a>
      <button class="btn" data-action="copy-place" data-id="${esc(p.id)}">${tr(L, 'copyAi')}</button>
    </div>
    <p class="small"><a href="${esc(links.apple)}" target="_blank" rel="noopener">${tr(L, 'appleMaps')}</a></p>

    ${notes.length ? `<div class="panel small"><b>${tr(L, 'yourNotes')}</b>${notes.map(e =>
      `<div>${esc(e.date)} <span class="starline">${stars(e.stars)}</span> ${esc(e.note)}</div>`).join('')}</div>` : ''}

    ${mustSee.length ? `<h2>${tr(L, 'dontMiss')}</h2><ul class="plain">${mustSee.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${etiquette ? `<h2>${tr(L, 'etiquette')}</h2><p>${esc(etiquette)}</p>` : ''}
    ${bestTime ? `<h2>${tr(L, 'bestTime')}</h2><p>${esc(bestTime)}</p>` : ''}
    ${transport ? `<h2>${tr(L, 'gettingThere')}</h2><p>${esc(transport)}</p>` : ''}

    <details>
      <summary>${tr(L, 'story')}</summary>
      <p>${esc(localized(p, 'historical_narrative', L))}</p>
      ${why ? `<p><b>${tr(L, 'whyMatters')}</b> ${esc(why)}</p>` : ''}
      ${look ? `<p><b>${tr(L, 'lookFor')}</b> ${esc(look)}</p>` : ''}
    </details>
    ${p.timeline?.length ? `<details>
      <summary>${tr(L, 'timeline')}</summary>
      <ul class="timeline">${p.timeline.map(t => `<li><b>${esc(t.year_or_era)}</b>${esc(localized(t, 'event', L))}</li>`).join('')}</ul>
    </details>` : ''}
  `;
}

/**
 * Markup for the "Show to driver" big card. Always Chinese: it is shown to a local.
 * @param {import('../types.js').Place} p
 * @returns {string}
 */
export function driverCard(p) {
  return `<div class="big">${esc(p.name.zh_TW)}</div>
    <div class="mid">${esc(p.location.address_zh)}</div>
    <div class="mid">請帶我到這裡，謝謝。</div>
    <div class="hint">"Please take me here, thank you."</div>`;
}
