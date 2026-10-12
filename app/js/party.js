// Party size: how many people the traveler is with, and phrases that change with it
// ("Two tickets, please" → "Three tickets, please"). Pure: no DOM, no storage.
// Contract tests: tests/core/party.test.js

import { parseSyllable } from './zhuyin.js';

/** @typedef {import('./types.js').Phrase} Phrase */

export const PARTY_KEY = 'tg.party.v1';
export const PARTY_MIN = 1;
export const PARTY_MAX = 10;
const PARTY_DEFAULT = 2;

// Measure-word forms for 1..10 (兩, not 二, before a measure word).
const ZH = ['一', '兩', '三', '四', '五', '六', '七', '八', '九', '十'];
const ZHUYIN = ['ㄧ', 'ㄌㄧㄤˇ', 'ㄙㄢ', 'ㄙˋ', 'ㄨˇ', 'ㄌㄧㄡˋ', 'ㄑㄧ', 'ㄅㄚ', 'ㄐㄧㄡˇ', 'ㄕˊ'];
const PINYIN = ['yī', 'liǎng', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ', 'shí'];
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * A usable party size: numbers are rounded and kept within PARTY_MIN..PARTY_MAX; anything else
 * (a string, NaN, null from damaged storage) gives the default, 2.
 * @param {unknown} x
 * @returns {number}
 */
export function clampParty(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return PARTY_DEFAULT;
  return Math.min(PARTY_MAX, Math.max(PARTY_MIN, Math.round(x)));
}

/**
 * English word for 1..10 ("one".."ten"); other numbers as digits.
 * @param {number} n
 * @returns {string}
 */
export function numberWord(n) {
  return WORDS[n - 1] ?? String(n);
}

/**
 * The phrase said for a party of n. A phrase without `party` comes back unchanged (same object).
 * Otherwise a copy where the first party.zh_TW / party.zhuyin syllable / party.pinyin is replaced by
 * the number for n, and en is party.en_one (n = 1) or party.en_other with {n} = "three" and {N} = "Three".
 * 一 is written yí before a 4th-tone syllable, yì before tones 1-3 and yī otherwise, as spokenTones
 * says it, judged by the Zhuyin syllable after the number. n is clamped with clampParty.
 * @param {Phrase} phrase
 * @param {number} n
 * @returns {Phrase}
 */
export function withParty(phrase, n) {
  const p = phrase.party;
  if (!p) return phrase;
  const k = clampParty(n) - 1;
  const syl = phrase.zhuyin.trim().split(/\s+/);
  const at = syl.indexOf(p.zhuyin);
  if (at >= 0) syl[at] = ZHUYIN[k];
  const next = at >= 0 ? parseSyllable(syl[at + 1] ?? '') : null;
  const one = !next || next.tone === 5 ? 'yī' : next.tone === 4 ? 'yí' : 'yì';
  const word = WORDS[k];
  const out = {
    ...phrase,
    zh_TW: phrase.zh_TW.replace(p.zh_TW, ZH[k]),
    zhuyin: syl.join(' '),
    pinyin: phrase.pinyin.replace(p.pinyin, k === 0 ? one : PINYIN[k]),
    en: k === 0 ? p.en_one : p.en_other.replace(/\{n\}/g, word).replace(/\{N\}/g, word[0].toUpperCase() + word.slice(1)),
  };
  if (phrase.tts) out.tts = phrase.tts.replace(p.zh_TW, ZH[k]);
  return out;
}
