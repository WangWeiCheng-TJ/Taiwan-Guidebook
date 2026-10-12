// Knowledge topics (#/learn, #/learn/<id>): short background reads linked to the places they explain.

import { esc, clip } from '../util.js';
import { tr, localized, localizedList } from '../lang.js';
import { topicById, placesForTopic } from '../topics.js';
import { isHttps } from './apps.js';

/**
 * Without an id (#/learn): every topic as a card (title, summary) linking to #/learn/<id>.
 * With an id (#/learn/<id>): the topic's title, summary and paragraphs, its related places
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
      ${topics.length ? topics.map(t => topicLink(t, L)).join('') : `<p>${tr(L, 'learn.none')}</p>`}
    `;
  }
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
 * Written by an agent and not yet checked by the owner (metadata.generated_by says "pending owner review").
 * @param {import('../types.js').Topic} t
 * @returns {boolean}
 */
export function isPending(t) {
  return /pending owner review/i.test(t.metadata?.generated_by || '');
}

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
