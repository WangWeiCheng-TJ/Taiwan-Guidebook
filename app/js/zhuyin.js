// Zhuyin (Bopomofo) pronunciation, broken down symbol by symbol with a romanization for each.
// Contract tests: tests/core/zhuyin.test.js

/**
 * @typedef {{ symbol: string, roman: string }} ZhuyinPart
 * @typedef {{ parts: ZhuyinPart[], tone: 1|2|3|4|5 }} Syllable   tone 5 = neutral (light) tone
 * @typedef {{ char: string, syllable: Syllable|null }} AlignedChar   syllable is null for punctuation
 */

/**
 * Romanization (Hanyu Pinyin letters) of every Zhuyin symbol, as used inside a syllable.
 * Initials: ㄅb ㄆp ㄇm ㄈf ㄉd ㄊt ㄋn ㄌl ㄍg ㄎk ㄏh ㄐj ㄑq ㄒx ㄓzh ㄔch ㄕsh ㄖr ㄗz ㄘc ㄙs
 * Medials:  ㄧi ㄨu ㄩü
 * Finals:   ㄚa ㄛo ㄜe ㄝê ㄞai ㄟei ㄠao ㄡou ㄢan ㄣen ㄤang ㄥeng ㄦer
 * Exactly these 37 keys.
 * @type {Readonly<Record<string, string>>}
 */
export const ZHUYIN_ROMAN = Object.freeze({
  ㄅ: 'b', ㄆ: 'p', ㄇ: 'm', ㄈ: 'f', ㄉ: 'd', ㄊ: 't', ㄋ: 'n', ㄌ: 'l', ㄍ: 'g', ㄎ: 'k', ㄏ: 'h',
  ㄐ: 'j', ㄑ: 'q', ㄒ: 'x', ㄓ: 'zh', ㄔ: 'ch', ㄕ: 'sh', ㄖ: 'r', ㄗ: 'z', ㄘ: 'c', ㄙ: 's',
  ㄧ: 'i', ㄨ: 'u', ㄩ: 'ü', ㄚ: 'a', ㄛ: 'o', ㄜ: 'e', ㄝ: 'ê', ㄞ: 'ai', ㄟ: 'ei', ㄠ: 'ao', ㄡ: 'ou',
  ㄢ: 'an', ㄣ: 'en', ㄤ: 'ang', ㄥ: 'eng', ㄦ: 'er',
});

const TONES = { 'ˉ': 1, 'ˊ': 2, 'ˇ': 3, 'ˋ': 4, '˙': 5 };

/**
 * Parse one syllable written in Zhuyin.
 * - Tone marks: "ˊ" → 2, "ˇ" → 3, "ˋ" → 4, "˙" → 5 (neutral; may come before OR after the symbols),
 *   "ˉ" or no mark → 1. At most one tone mark.
 * - Every other character must be a key of ZHUYIN_ROMAN; parts keep their order.
 * - A syllable that is ONLY one of ㄓㄔㄕㄖㄗㄘㄙ (plus an optional tone mark) is pronounced with its built-in vowel,
 *   so its roman is zhi, chi, shi, ri, zi, ci, si instead of zh, ch, sh, r, z, c, s.
 * - Surrounding whitespace is ignored.
 * @param {string} syllable  e.g. "ㄋㄧˇ", "˙ㄒㄧㄝ", "ㄕㄨㄛ", "ㄓˇ"
 * @returns {Syllable|null}  null when empty, no symbols, an unknown character, or more than one tone mark
 */
export function parseSyllable(syllable) {
  const s = syllable.trim();
  if (!s) return null;
  let tone = null;
  const parts = [];
  for (const ch of s) {
    if (ch in TONES) {
      if (tone !== null) return null;
      tone = TONES[ch];
    } else if (ch in ZHUYIN_ROMAN) {
      parts.push({ symbol: ch, roman: ZHUYIN_ROMAN[ch] });
    } else {
      return null;
    }
  }
  if (!parts.length) return null;
  if (parts.length === 1 && 'ㄓㄔㄕㄖㄗㄘㄙ'.includes(parts[0].symbol)) {
    parts[0].roman += 'i';
  }
  return { parts, tone: tone ?? 1 };
}

/**
 * Pair each character of a Chinese phrase with its Zhuyin syllable.
 * `zhuyin` holds one syllable per Han character (\p{Script=Han}), separated by any whitespace.
 * Non-Han characters (punctuation like "，" "？" "！") get syllable null and consume nothing.
 * @param {string} zh       e.g. "不要辣，謝謝"
 * @param {string} zhuyin   e.g. "ㄅㄨˊ ㄧㄠˋ ㄌㄚˋ ㄒㄧㄝˋ ˙ㄒㄧㄝ"
 * @returns {AlignedChar[]|null}  null when the syllable count differs from the Han character count,
 *                                or any syllable fails parseSyllable
 */
export function alignZhuyin(zh, zhuyin) {
  const syllables = zhuyin.trim() ? zhuyin.trim().split(/\s+/) : [];
  const hanChars = [...zh].filter(c => /\p{Script=Han}/u.test(c));
  if (syllables.length !== hanChars.length) return null;
  const parsed = syllables.map(parseSyllable);
  if (parsed.some(s => !s)) return null;
  let i = 0;
  return [...zh].map(char => ({
    char,
    syllable: /\p{Script=Han}/u.test(char) ? parsed[i++] : null,
  }));
}
