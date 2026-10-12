// Recommended apps (#/apps): phone apps worth installing before the trip, grouped by what they are for.

import { esc } from '../util.js';
import { tr, localized } from '../lang.js';

/** Display order of App.category; scripts/build_dataset.py validates data/apps.json against the same list. */
export const APP_CATEGORIES = ['getting-around', 'taxi', 'trains', 'messaging', 'language', 'weather', 'food'];

/**
 * Only https links are rendered as links (data is validated by the build; this is a second guard).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isHttps(url) {
  return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url);
}

/**
 * Recommended apps page (#/apps): one section per APP_CATEGORIES entry that has apps, apps in data order
 * (the build rejects other categories). Each card: name in the UI language (the other language small,
 * when different), why, platforms, and a link to the app's official page (new tab).
 * Works with bundles that have no apps.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderApps(s) {
  const L = s.lang;
  const apps = s.data?.apps || [];
  const sections = APP_CATEGORIES
    .map(cat => [cat, apps.filter(a => a.category === cat)])
    .filter(([, list]) => list.length);
  return `
    <a href="#/tips" class="small">${tr(L, 'learn.backTips')}</a>
    <h1>${tr(L, 'apps.title')}</h1>
    <p class="muted small">${tr(L, 'apps.intro')}</p>
    ${sections.length ? sections.map(([cat, list]) => `
      <h2>${tr(L, `apps.cat.${cat}`)}</h2>
      ${list.map(a => appCard(a, L)).join('')}`).join('') : `<p>${tr(L, 'apps.none')}</p>`}
  `;
}

/**
 * One app.
 * @param {import('../types.js').App} a
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
function appCard(a, L) {
  const other = L === 'en' ? 'zh_TW' : 'en';
  const name = localized(a, 'name', L);
  const otherName = localized(a, 'name', other);
  const platforms = (a.platforms || []).map(p => (p === 'ios' || p === 'android' ? tr(L, `apps.${p}`) : esc(p))).join(' · ');
  return `<div class="card app">
    <div class="title">${esc(name)}${otherName && otherName !== name
      ? ` <span class="muted small" lang="${other === 'zh_TW' ? 'zh-TW' : 'en'}">${esc(otherName)}</span>` : ''}</div>
    <p>${esc(localized(a, 'why', L))}</p>
    <div class="row spread app-foot">
      <span class="muted small">${platforms}</span>
      ${isHttps(a.url) ? `<a class="btn small" href="${esc(a.url)}" target="_blank" rel="noopener">${tr(L, 'apps.open')}</a>` : ''}
    </div>
  </div>`;
}
