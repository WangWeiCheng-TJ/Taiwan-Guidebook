// Phrases and tips: static reference content from the guidebook.

import { esc, titleCase } from '../util.js';

/**
 * @template T
 * @param {T[]} items
 * @param {(t: T) => string} key
 * @returns {[string, T[]][]} groups in first-seen order
 */
function groupBy(items, key) {
  /** @type {Map<string, T[]>} */
  const m = new Map();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()];
}

/**
 * Phrases tab (#/phrases): grouped by category; each card shows English, big Chinese, pinyin.
 * Emits: data-action="speak" (only when speechSynthesis exists) | "show-phrase", data-id = phrase id.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderPhrases(s) {
  const canSpeak = typeof speechSynthesis !== 'undefined';
  return `
    <h1>Phrases</h1>
    <p class="muted small">Tap <b>Show</b> to display it big for the person you're talking to.</p>
    ${groupBy(s.data.phrases, p => p.category).map(([cat, list]) => `
      <h2>${esc(titleCase(cat))}</h2>
      ${list.map(ph => `<div class="card phrase">
        <div class="meta">${esc(ph.en)}</div>
        <div class="zhbig">${esc(ph.zh_TW)}</div>
        <div class="row spread">
          <span class="py">${esc(ph.pinyin)}</span>
          <span class="row">
            ${canSpeak ? `<button class="btn small" data-action="speak" data-id="${esc(ph.id)}">▶ Play</button>` : ''}
            <button class="btn small" data-action="show-phrase" data-id="${esc(ph.id)}">Show</button>
          </span>
        </div>
      </div>`).join('')}
    `).join('')}
  `;
}

/**
 * Markup for a phrase on the big card.
 * @param {import('../types.js').Phrase} ph
 * @returns {string}
 */
export function phraseCard(ph) {
  return `<div class="big">${esc(ph.zh_TW)}</div><div class="hint">${esc(ph.en)} · ${esc(ph.pinyin)}</div>`;
}

/**
 * Tips tab (#/tips): grouped by category.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderTips(s) {
  return `
    <h1>Good to know</h1>
    ${groupBy(s.data.tips, t => t.category).map(([cat, list]) => `
      <h2>${esc(titleCase(cat))}</h2>
      ${list.map(t => `<div class="card"><div class="title">${esc(t.title_en)}</div><p>${esc(t.body_en)}</p></div>`).join('')}
    `).join('')}
  `;
}
