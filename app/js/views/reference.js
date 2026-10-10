// Phrases and tips: static reference content from the guidebook.

import { esc } from '../util.js';
import { tr, localized } from '../lang.js';
import { alignZhuyin } from '../zhuyin.js';

const TONE_MARK = { 1: '', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ', 5: '˙' };

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
 * Pronunciation block: each character over its Zhuyin, each symbol over its romanization, tone as a number.
 * Falls back to the raw Zhuyin string if it can't be aligned.
 * @param {import('../types.js').Phrase & { zhuyin: string }} ph
 * @returns {string}
 */
export function zhuyinBlock(ph) {
  let aligned = null;
  try { aligned = alignZhuyin(ph.zh_TW, ph.zhuyin); } catch { aligned = null; }
  if (!aligned) return `<div class="zhbig">${esc(ph.zh_TW)}</div><div class="py">${esc(ph.zhuyin)}</div>`;
  return `<div class="zy" lang="zh-TW">${aligned.map(({ char, syllable }) => syllable ? `
    <div class="zc">
      <div class="han">${esc(char)}</div>
      <div class="syl">${syllable.parts.map(p => `<span class="zp"><b>${esc(p.symbol)}</b><i>${esc(p.roman)}</i></span>`).join('')}<span class="zp tone t${syllable.tone}"><b>${TONE_MARK[syllable.tone] || '&nbsp;'}</b><i>${syllable.tone}</i></span></div>
    </div>` : `<div class="zc punct"><div class="han">${esc(char)}</div></div>`).join('')}</div>`;
}

/**
 * Phrases tab (#/phrases): grouped by category; each card shows the meaning, then the Chinese
 * with Zhuyin broken down symbol by symbol.
 * Emits: data-action="speak" (only when speechSynthesis exists) | "show-phrase", data-id = phrase id.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderPhrases(s) {
  const L = s.lang;
  const canSpeak = typeof speechSynthesis !== 'undefined';
  return `
    <h1>${tr(L, 'phrases')}</h1>
    <p class="muted small">${tr(L, 'phrasesIntro')}<br>${tr(L, 'toneLegend')}</p>
    ${groupBy(s.data.phrases, p => p.category).map(([cat, list]) => `
      <h2>${tr(L, `cat.${cat}`)}</h2>
      ${list.map(ph => `<div class="card phrase">
        <div class="row spread">
          <span class="meta">${esc(ph.en)}</span>
          <span class="row">
            ${canSpeak ? `<button class="btn small" data-action="speak" data-id="${esc(ph.id)}">${tr(L, 'play')}</button>` : ''}
            <button class="btn small" data-action="show-phrase" data-id="${esc(ph.id)}">${tr(L, 'show')}</button>
          </span>
        </div>
        ${zhuyinBlock(ph)}
      </div>`).join('')}
    `).join('')}
  `;
}

/**
 * Markup for a phrase on the big card.
 * @param {import('../types.js').Phrase & { zhuyin: string }} ph
 * @returns {string}
 */
export function phraseCard(ph) {
  return `<div class="big">${esc(ph.zh_TW)}</div><div class="hint">${esc(ph.en)}</div>`;
}

/**
 * Tips tab (#/tips): grouped by category, in s.lang (falls back to English).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderTips(s) {
  const L = s.lang;
  return `
    <h1>${tr(L, 'tips')}</h1>
    ${groupBy(s.data.tips, t => t.category).map(([cat, list]) => `
      <h2>${tr(L, `cat.${cat}`)}</h2>
      ${list.map(t => `<div class="card"><div class="title">${esc(localized(t, 'title', L))}</div><p>${esc(localized(t, 'body', L))}</p></div>`).join('')}
    `).join('')}
  `;
}
