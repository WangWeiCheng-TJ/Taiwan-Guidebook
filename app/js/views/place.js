import { esc, stars } from '../util.js';
import { distanceTo, fmtKm, mapsLinks, osmEmbedUrl, osmLink } from '../geo.js';
import { placeById } from '../data.js';
import { topicsForPlace } from '../topics.js';
import { topicLink } from './learn.js';
import { isHttps } from './apps.js';
import { notesFor } from '../triplog.js';
import { places } from '../state.js';
import { tr, localized, localizedList } from '../lang.js';
import { placeName } from './common.js';
import { phrasesForPlace, mainGroupForPlace } from '../phrases.js';
import { withParty } from '../party.js';

/**
 * Place page (#/place/<id>): header, badges, photo (online only), summary, action buttons, the user's notes,
 * practical sections with a collapsed map (online only), then the story and timeline collapsed, and
 * "Learn more" topics. Content follows s.lang (falls back to English).
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
    ${photoFigure(p, L)}
    <p>${esc(localized(p, 'summary', L))}</p>

    <div class="row">
      <a class="btn primary" href="${esc(links.google)}" target="_blank" rel="noopener">${tr(L, 'navigate')}</a>
      <button class="btn" data-action="driver" data-id="${esc(p.id)}">${tr(L, 'driver')}</button>
      <a class="btn" href="#/log/${esc(p.id)}">${tr(L, 'wasHere')}</a>
      <button class="btn" data-action="copy-place" data-id="${esc(p.id)}">${tr(L, 'copyAi')}</button>
    </div>
    ${isAppleDevice() ? `<p class="small"><a href="${esc(links.apple)}" target="_blank" rel="noopener">${tr(L, 'appleMaps')}</a></p>` : ''}

    ${notes.length ? `<div class="panel small"><b>${tr(L, 'yourNotes')}</b>${notes.map(e =>
      `<div>${esc(e.date)} <span class="starline">${stars(e.stars)}</span> ${esc(e.note)}</div>`).join('')}</div>` : ''}

    ${mustSeeSection(g, L)}
    ${etiquette ? `<h2>${tr(L, 'etiquette')}</h2><p>${esc(etiquette)}</p>` : ''}
    ${bestTime ? `<h2>${tr(L, 'bestTime')}</h2><p>${esc(bestTime)}</p>` : ''}
    ${transport ? `<h2>${tr(L, 'gettingThere')}</h2><p>${esc(transport)}</p>` : ''}
    ${mapSection(p, L)}

    ${usefulPhrases(s, p)}

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
    ${learnMore(s, p)}
  `;
}

/**
 * "Don't miss": tap an item to see why it matters (foreign_visitor_guide.must_see).
 * Older entries only have must_see_spots_*: shown as a plain list.
 * @param {Record<string, any>} g  foreign_visitor_guide
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function mustSeeSection(g, L) {
  if (Array.isArray(g.must_see) && g.must_see.length) {
    return `<h2>${tr(L, 'dontMiss')}</h2>
      <p class="muted small">${tr(L, 'tapWhy')}</p>
      ${g.must_see.map(m => {
        const name = esc(localized(m, 'name', L));
        const why = localized(m, 'why', L);
        return why
          ? `<details class="must"><summary>${name}</summary><p>${esc(why)}</p></details>`
          : `<div class="must plain">${name}</div>`;
      }).join('')}`;
  }
  const list = localizedList(g, 'must_see_spots', L);
  return list.length ? `<h2>${tr(L, 'dontMiss')}</h2><ul class="plain">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
}

/**
 * Apple Maps is offered only on iPhone/iPad (including iPadOS, which reports itself as a Mac with touch).
 * @returns {boolean}
 */
function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * "Useful here": a few phrases picked by the kind of place, said for s.party people. Tapping a row opens it in a sheet
 * (data-action="phrase-sheet"); "More phrases" opens the whole category in a sheet
 * (data-action="phrases-sheet" data-group), so the user never leaves this page.
 * @param {import('../state.js').AppState} s
 * @param {import('../types.js').Place} p
 * @returns {string}
 */
function usefulPhrases(s, p) {
  const L = s.lang;
  const list = phrasesForPlace(p, s.data.phrases).map(ph => withParty(ph, s.party));
  if (!list.length) return '';
  return `<h2>${tr(L, 'usefulHere')}</h2>
    ${list.map(ph => `<button class="phrase-row" data-action="phrase-sheet" data-id="${esc(ph.id)}">
      <span><span class="zh-inline" lang="zh-TW">${esc(ph.zh_TW)}</span> <span class="muted small">${esc(ph.en)}</span></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`).join('')}
    <button class="linklike small" data-action="phrases-sheet" data-group="${mainGroupForPlace(p)}">${tr(L, 'morePhrases')}</button>`;
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

/**
 * The place's photo with its mandatory credit line, or nothing when the photo or its credit is incomplete.
 * Loaded from Wikimedia (online only): main.js hides the figure when the image fails, e.g. offline.
 * @param {import('../types.js').Place} p
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function photoFigure(p, L) {
  const ph = p.photo;
  if (!ph || !isHttps(ph.src) || !ph.author || !ph.license) return '';
  const license = isHttps(ph.license_url)
    ? `<a href="${esc(ph.license_url)}" target="_blank" rel="noopener">${esc(ph.license)}</a>`
    : esc(ph.license);
  const commons = isHttps(ph.page) ? ` · <a href="${esc(ph.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : '';
  return `<figure class="photo">
      <img class="photo" src="${esc(ph.src)}" loading="lazy" alt="${esc(placeName(p, L))}">
      <figcaption class="muted small">${tr(L, 'photo.credit', { author: esc(ph.author) })}, ${license}${commons}</figcaption>
    </figure>`;
}

/**
 * Collapsed OpenStreetMap embed around the place, plus a link to the full map. The iframe is lazy, so
 * nothing is fetched until the user opens the section; it needs a connection.
 * @param {import('../types.js').Place} p
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function mapSection(p, L) {
  const c = p.location.coordinates;
  return `<details class="map">
      <summary>${tr(L, 'map.title')}</summary>
      <div class="map-embed"><iframe loading="lazy" title="${esc(tr(L, 'map.of', { name: placeName(p, L) }))}" src="${esc(osmEmbedUrl(c.lat, c.lng))}"></iframe></div>
      <p class="small"><a href="${esc(osmLink(c.lat, c.lng))}" target="_blank" rel="noopener">${tr(L, 'map.open')}</a>
        <span class="muted">· ${tr(L, 'map.online')}</span></p>
    </details>`;
}

/**
 * "Learn more": knowledge topics about this place (topics.js topicsForPlace), as links to #/learn/<id>.
 * @param {import('../state.js').AppState} s
 * @param {import('../types.js').Place} p
 * @returns {string}
 */
function learnMore(s, p) {
  const list = topicsForPlace(p, s.data.topics);
  if (!list.length) return '';
  return `<h2>${tr(s.lang, 'learn.more')}</h2>
    ${list.map(t => topicLink(t, s.lang)).join('')}`;
}
