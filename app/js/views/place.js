import { esc, stars } from '../util.js';
import { distanceTo, fmtKm, mapsLinks } from '../geo.js';
import { placeById } from '../data.js';
import { notesFor } from '../triplog.js';
import { places } from '../state.js';

/**
 * Place page (#/place/<id>): header, badges, summary, action buttons, the user's notes,
 * practical sections, then the story and timeline collapsed.
 * Emits: data-action="driver" | "copy-place" (data-id = place id).
 * Links: Google Maps directions, Apple Maps, #/log/<id> ("I was here" prefills the log form).
 * @param {import('../state.js').AppState} s
 * @param {string} id  place id from the route
 * @returns {string}
 */
export function renderPlace(s, id) {
  const p = placeById(places(), id);
  if (!p) return `<p>Place not found. <a href="#/explore">Back</a></p>`;
  const g = p.foreign_visitor_guide || {};
  const c = p.cultural_significance || {};
  const d = distanceTo(p, s.pos);
  const links = mapsLinks(p);
  const notes = notesFor(s.log, p.id);

  return `
    <a href="#/explore" class="small">‹ All places</a>
    <h1>${esc(p.name.en)}</h1>
    <div class="zh">${esc(p.name.zh_TW)}</div>
    <div class="muted small">${esc(p.location.district_en)}, ${esc(p.location.city_en)}${d != null ? ` · ${fmtKm(d)} away` : ''}</div>
    <div class="row" style="margin:10px 0">
      ${p.heritage_status ? `<span class="badge">${esc(p.heritage_status)}</span>` : ''}
      ${p.established_year ? `<span class="badge warm">Since ${esc(p.established_year)}</span>` : ''}
      ${g.recommended_duration_min ? `<span class="badge warm">~${esc(g.recommended_duration_min)} min</span>` : ''}
    </div>
    <p>${esc(p.summary.en)}</p>

    <div class="row">
      <a class="btn primary" href="${esc(links.google)}" target="_blank" rel="noopener">Navigate</a>
      <button class="btn" data-action="driver" data-id="${esc(p.id)}">Show to driver</button>
      <a class="btn" href="#/log/${esc(p.id)}">I was here</a>
      <button class="btn" data-action="copy-place" data-id="${esc(p.id)}">Copy for AI</button>
    </div>
    <p class="small"><a href="${esc(links.apple)}" target="_blank" rel="noopener">Open in Apple Maps</a></p>

    ${notes.length ? `<div class="panel small"><b>Your notes</b>${notes.map(e =>
      `<div>${esc(e.date)} <span class="starline">${stars(e.stars)}</span> ${esc(e.note)}</div>`).join('')}</div>` : ''}

    ${g.must_see_spots_en?.length ? `<h2>Don't miss</h2><ul class="plain">${g.must_see_spots_en.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${g.etiquette_tips_en ? `<h2>Etiquette</h2><p>${esc(g.etiquette_tips_en)}</p>` : ''}
    ${g.best_time_to_visit ? `<h2>Best time</h2><p>${esc(g.best_time_to_visit)}</p>` : ''}
    ${g.transportation_en ? `<h2>Getting there</h2><p>${esc(g.transportation_en)}</p>` : ''}

    <details>
      <summary>The story</summary>
      <p>${esc(p.historical_narrative?.en)}</p>
      ${c.why_it_matters_en ? `<p><b>Why it matters.</b> ${esc(c.why_it_matters_en)}</p>` : ''}
      ${c.architectural_highlights_en ? `<p><b>Look for.</b> ${esc(c.architectural_highlights_en)}</p>` : ''}
    </details>
    ${p.timeline?.length ? `<details>
      <summary>Timeline</summary>
      <ul class="timeline">${p.timeline.map(t => `<li><b>${esc(t.year_or_era)}</b>${esc(t.event_en)}</li>`).join('')}</ul>
    </details>` : ''}
  `;
}

/**
 * Markup for the "Show to driver" big card.
 * @param {import('../types.js').Place} p
 * @returns {string}
 */
export function driverCard(p) {
  return `<div class="big">${esc(p.name.zh_TW)}</div>
    <div class="mid">${esc(p.location.address_zh)}</div>
    <div class="mid">請帶我到這裡，謝謝。</div>
    <div class="hint">"Please take me here, thank you."</div>`;
}
