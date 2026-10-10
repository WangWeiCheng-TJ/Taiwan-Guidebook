// Language-agnostic text lookup for the per-language data format.
// Contract tests: tests/tasks/i18n.test.js

/** @typedef {Object<string, string|string[]>} Localized  e.g. { "en": "...", "zh_TW": "...", "de": "..." } */

export const DEFAULT_LANG = 'en';

/**
 * Pick the text for a language.
 * - value is a string → returned as is (old data, or fields that are not translated)
 * - value is a Localized map → value[lang], else value[fallback], else the first non-empty value, else ""
 * - null/undefined → "" (or [] when the chosen value would be an array; see tList)
 * @param {string|Localized|null|undefined} value
 * @param {string} [lang]
 * @param {string} [fallback]
 * @returns {string}
 */
export function t(value, lang = DEFAULT_LANG, fallback = DEFAULT_LANG) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || Array.isArray(value)) return '';
  const val = value[lang];
  if (typeof val === 'string' && val.length > 0) return val;
  const fb = value[fallback];
  if (typeof fb === 'string' && fb.length > 0) return fb;
  for (const v of Object.values(value)) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

/**
 * Same lookup as t() for list fields (e.g. must_see_spots). Always returns an array.
 * @param {string[]|Localized|null|undefined} value
 * @param {string} [lang]
 * @param {string} [fallback]
 * @returns {string[]}
 */
export function tList(value, lang = DEFAULT_LANG, fallback = DEFAULT_LANG) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object') return [];
  const val = value[lang];
  if (Array.isArray(val) && val.length > 0) return val;
  const fb = value[fallback];
  if (Array.isArray(fb) && fb.length > 0) return fb;
  for (const v of Object.values(value)) {
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}

/**
 * Languages present in a Localized map, in the order: "en", "zh_TW", then others alphabetically.
 * @param {Localized|null|undefined} value
 * @returns {string[]}
 */
export function languagesOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const keys = Object.keys(value);
  const result = [];
  if (keys.includes('en')) result.push('en');
  if (keys.includes('zh_TW')) result.push('zh_TW');
  const others = keys.filter(k => k !== 'en' && k !== 'zh_TW').sort();
  return result.concat(others);
}
