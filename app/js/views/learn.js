// Knowledge topics (#/learn, #/learn/<id>): short background reads linked to the places they explain, and the
// timeline of all places (#/learn/timeline).

import { esc, clip } from '../util.js';
import { tr, localized, localizedList } from '../lang.js';
import { isPending } from '../data.js';
import { topicById, placesForTopic } from '../topics.js';
import { TIMELINE_ID, ERA_KEYS, mergeTimeline, eraLabel } from '../timeline.js';
import { buildTimelinePrompt } from '../prompt.js';
import { isHttps } from './apps.js';

/**
 * Without an id (#/learn): a card linking to the timeline of all places (#/learn/timeline) when the places have
 * timeline events, then every topic as a card (title, summary) linking to #/learn/<id>.
 * With the id "timeline": renderTimeline.
 * With another id (#/learn/<id>): the topic's title, summary and paragraphs, its related places
 * (links to #/place/<id>), its sources, and a note while it waits for the owner's review.
 * Content follows s.lang (falls back to English). Works with bundles that have no topics.
 * @param {import('../state.js').AppState} s
 * @param {string} [id]  topic id from the route
 * @returns {string}
 */
export function renderLearn(s, id) {
  const L = s.lang;
  const topics = s.data?.topics || [];
  if (!id) {
    return `
      <a href="#/tips" class="small">${tr(L, 'learn.backTips')}</a>
      <h1>${tr(L, 'learn.title')}</h1>
      <p class="muted small">${tr(L, 'learn.intro')}</p>
      ${mergeTimeline(s.data?.places || []).length ? `<a class="card" href="#/learn/${TIMELINE_ID}">
        <div class="title">${tr(L, 'timeline.title')}</div>
        <div class="meta">${tr(L, 'timeline.summary')}</div>
      </a>` : ''}
      ${topics.length ? topics.map(t => topicLink(t, L)).join('') : `<p>${tr(L, 'learn.none')}</p>`}
    `;
  }
  if (id === TIMELINE_ID) return renderTimeline(s);
  const t = topicById(topics, id);
  if (!t) return `<p>${tr(L, 'learn.notFound')} <a href="#/learn">${tr(L, 'back')}</a></p>`;
  const related = placesForTopic(t, s.data?.places || []);
  const sources = t.metadata?.sources || [];
  return `
    <a href="#/learn" class="small">${tr(L, 'learn.all')}</a>
    <h1>${esc(localized(t, 'title', L))}</h1>
    <p class="muted">${esc(localized(t, 'summary', L))}</p>
    ${isPending(t) ? `<p class="muted small pending">${tr(L, 'learn.pending')}</p>` : ''}
    ${localizedList(t, 'body', L).map(par => `<p>${esc(par)}</p>`).join('')}
    ${related.length ? `<h2>${tr(L, 'learn.places')}</h2>
      ${related.map(p => `<a class="card" href="#/place/${esc(p.id)}">
        <div class="title">${esc(localized(p, 'name', L))}</div>
        <div class="meta">${esc(localized(p.location, 'district', L))}, ${esc(localized(p.location, 'city', L))}</div>
      </a>`).join('')}` : ''}
    ${sources.length ? `<h2>${tr(L, 'learn.sources')}</h2>
      <ul class="plain sources small">${sources.map(u => `<li>${isHttps(u)
        ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(shortUrl(u))}</a>`
        : esc(u)}</li>`).join('')}</ul>` : ''}
  `;
}

/**
 * "Taiwan through the places" (#/learn/timeline): every place's timeline events on one timeline (mergeTimeline),
 * under era headings in the UI language, each event with its year as written, its text in s.lang and a link to its
 * place (name and city); an event from a place still pending owner review carries the Learn page's draft note.
 * "Copy for AI" (data-action="copy-timeline") copies buildTimelinePrompt; it is left out when there are no events.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderTimeline(s) {
  const L = s.lang;
  const groups = mergeTimeline(s.data?.places || []);
  const en = L === 'en' ? '' : ' lang="en"'; // English text inside the Chinese UI
  return `
    <a href="#/learn" class="small">${tr(L, 'timeline.back')}</a>
    <h1>${tr(L, 'timeline.title')}</h1>
    <p class="muted small">${tr(L, 'timeline.intro')}</p>
    ${groups.length ? `<div class="row"><button class="btn" data-action="copy-timeline">${tr(L, 'copyAi')}</button></div>` : `<p>${tr(L, 'timeline.none')}</p>`}
    ${groups.map(g => `<h2${g.era && !(g.era in ERA_KEYS) ? en : ''}>${esc(eraLabel(g.era, L))}</h2>
      <ul class="timeline">${g.events.map(e => timelineItem(e, L, en)).join('')}</ul>`).join('')}
  `;
}

/**
 * One event: year as written, text, the link to its place, the draft note. The link's text is one <span>, so a long
 * name and its city wrap as one line of text in the flex row.
 * @param {import('../timeline.js').TimelineEvent} e
 * @param {import('../lang.js').Lang} L
 * @param {string} en  ' lang="en"' in the Chinese UI, else ''
 * @returns {string}
 */
function timelineItem(e, L, en) {
  const city = localized(e.place.location, 'city', L);
  return `<li>
        <b${/[a-z]/i.test(e.when) ? en : ''}>${esc(e.when)}</b>${esc(localized(e, 'event', L))}
        <a class="row-link small" href="#/place/${esc(e.place.id)}"><span>${esc(localized(e.place, 'name', L))}${city ? `<span class="muted">&nbsp;· ${esc(city)}</span>` : ''}</span></a>
        ${e.pending ? `<span class="muted small pending">${tr(L, 'learn.pending')}</span>` : ''}
      </li>`;
}

/**
 * The text "Copy for AI" copies on the timeline page.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function timelinePrompt(s) {
  return buildTimelinePrompt(mergeTimeline(s.data?.places || []), s.lang);
}

/**
 * A topic as a card linking to its page; also used by the place page's "Learn more".
 * @param {import('../types.js').Topic} t
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function topicLink(t, L) {
  return `<a class="card" href="#/learn/${esc(t.id)}">
    <div class="title">${esc(localized(t, 'title', L))}</div>
    <div class="meta">${esc(localized(t, 'summary', L))}</div>
  </a>`;
}

/**
 * Written by an agent and not yet checked by the owner (metadata.generated_by says "pending owner review"): a topic,
 * or a place on the timeline. Defined in data.js.
 */
export { isPending };

/**
 * Readable link text: percent-escapes decoded, no scheme or "www.", at most 60 characters.
 * @param {string} url
 * @returns {string}
 */
function shortUrl(url) {
  let u = url;
  try { u = decodeURI(url); } catch { /* malformed escape: keep it as is */ }
  return clip(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), 60);
}
