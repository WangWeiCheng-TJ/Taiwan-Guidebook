// Phrases and tips: static reference content from the guidebook.

import { esc } from '../util.js';
import { tr, localized } from '../lang.js';
import { alignZhuyin, spokenTones } from '../zhuyin.js';
import { PHRASE_GROUPS, phrasesIn } from '../phrases.js';
import { PARTY_MIN, PARTY_MAX, withParty } from '../party.js';

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
  // Zhuyin shows dictionary tones; the number under it is the tone actually spoken (after sandhi).
  let spoken;
  try { spoken = spokenTones(aligned); } catch { spoken = aligned.map(a => a.syllable?.tone ?? null); }
  return `<div class="zy" lang="zh-TW">${aligned.map(({ char, syllable }, i) => syllable ? `
    <div class="zc say" data-action="say" data-say="${esc(char)}" role="button" tabindex="0">
      <div class="han">${esc(char)}</div>
      <div class="syl">${syllable.parts.map(p => `<span class="zp"><b>${esc(p.symbol)}</b><i>${esc(p.roman)}</i></span>`).join('')}<span class="zp tone"><b>${TONE_MARK[syllable.tone] || '&nbsp;'}</b><i>${spoken[i]}</i></span></div>
    </div>` : `<div class="zc punct"><div class="han">${esc(char)}</div></div>`).join('')}</div>`;
}

/**
 * Phrases tab (#/phrases): grouped by category; each card shows the meaning, then the Chinese
 * with Zhuyin broken down symbol by symbol.
 * Without a group (#/phrases): big category tiles linking to #/phrases/<group>.
 * With a group: that group's phrase cards, said for s.party people (withParty), with the party
 * control on top when any of them changes with the party size.
 * @param {import('../state.js').AppState} s
 * @param {string} [group]  a PHRASE_GROUPS id
 * @returns {string}
 */
export function renderPhrases(s, group) {
  const L = s.lang;
  const known = PHRASE_GROUPS.find(g => g.id === group);
  if (!known) {
    return `
      <h1>${tr(L, 'phrases')}</h1>
      <p class="muted small">${tr(L, 'pickCategory')}</p>
      <div class="tiles">${PHRASE_GROUPS.map(g => `
        <a class="tile" href="#/phrases/${g.id}">
          <span class="tile-icon">${g.icon}</span>
          <span class="tile-label">${tr(L, `cat.${g.id}`)}</span>
          <span class="tile-count">${phrasesIn(s.data.phrases, g.id).length}</span>
        </a>`).join('')}
      </div>`;
  }
  const list = phrasesIn(s.data.phrases, known.id);
  return `
    <a href="#/phrases" class="small">${tr(L, 'allCategories')}</a>
    <h1>${known.icon} ${tr(L, `cat.${known.id}`)}</h1>
    ${list.some(ph => ph.party) ? partyControl(L, s.party) : ''}
    <p class="muted small">${tr(L, 'phrasesIntro')} ${typeof speechSynthesis !== 'undefined' ? tr(L, 'tapToHear') : ''}<br>${tr(L, 'toneLegend')}</p>
    ${list.map(ph => phraseCardFull(withParty(ph, s.party), L)).join('')}
  `;
}

/**
 * Compact "People: − 2 +" control. The buttons are disabled at PARTY_MIN / PARTY_MAX.
 * Emits: data-action="party-dec" | "party-inc".
 * @param {import('../lang.js').Lang} L
 * @param {number} n  current party size
 * @returns {string}
 */
export function partyControl(L, n) {
  return `<div class="row party">
    <span class="muted small">${tr(L, 'party.label')}</span>
    <button class="btn small" data-action="party-dec" aria-label="${esc(tr(L, 'party.dec'))}" ${n <= PARTY_MIN ? 'disabled' : ''}>−</button>
    <b class="party-n" aria-live="polite">${esc(n)}</b>
    <button class="btn small" data-action="party-inc" aria-label="${esc(tr(L, 'party.inc'))}" ${n >= PARTY_MAX ? 'disabled' : ''}>+</button>
  </div>`;
}

/**
 * One phrase: meaning, buttons, then Chinese with Zhuyin and per-symbol pronunciation.
 * Emits: data-action="speak" (only when speechSynthesis exists) | "show-phrase", data-id = phrase id.
 * @param {import('../types.js').Phrase & { zhuyin: string }} ph
 * @param {import('../lang.js').Lang} L
 * @returns {string}
 */
export function phraseCardFull(ph, L) {
  const canSpeak = typeof speechSynthesis !== 'undefined';
  return `<div class="card phrase">
    <div class="row spread">
      <span class="meta">${esc(ph.en)}</span>
      <span class="row">
        ${canSpeak ? `<button class="btn small" data-action="speak" data-id="${esc(ph.id)}">${tr(L, 'play')}</button>` : ''}
        <button class="btn small" data-action="show-phrase" data-id="${esc(ph.id)}">${tr(L, 'show')}</button>
      </span>
    </div>
    ${zhuyinBlock(ph)}
  </div>`;
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
 * Tips tab (#/tips): two tiles linking to the recommended apps (#/apps) and the knowledge topics (#/learn),
 * then the tips grouped by category, in s.lang (falls back to English).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderTips(s) {
  const L = s.lang;
  const tiles = [
    { href: '#/apps', icon: '📱', label: tr(L, 'apps.title'), n: (s.data.apps || []).length },
    { href: '#/learn', icon: '📖', label: tr(L, 'learn.title'), n: (s.data.topics || []).length },
  ];
  return `
    <h1>${tr(L, 'tips')}</h1>
    <div class="tiles">${tiles.map(t => `
      <a class="tile" href="${t.href}">
        <span class="tile-icon">${t.icon}</span>
        <span class="tile-label">${t.label}</span>
        ${t.n ? `<span class="tile-count">${t.n}</span>` : ''}
      </a>`).join('')}
    </div>
    ${groupBy(s.data.tips, t => t.category).map(([cat, list]) => `
      <h2>${tr(L, `cat.${cat}`)}</h2>
      ${list.map(t => `<div class="card"><div class="title">${esc(localized(t, 'title', L))}</div><p>${esc(localized(t, 'body', L))}</p></div>`).join('')}
    `).join('')}
  `;
}
