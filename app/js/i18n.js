// TASK T4 (see docs/SPEC.md): language-agnostic text lookup for the per-language data format.
// Implement the bodies; do not change names, parameters or return shapes.
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
  throw new Error('TODO(T4): t');
}

/**
 * Same lookup as t() for list fields (e.g. must_see_spots). Always returns an array.
 * @param {string[]|Localized|null|undefined} value
 * @param {string} [lang]
 * @param {string} [fallback]
 * @returns {string[]}
 */
export function tList(value, lang = DEFAULT_LANG, fallback = DEFAULT_LANG) {
  throw new Error('TODO(T4): tList');
}

/**
 * Languages present in a Localized map, in the order: "en", "zh_TW", then others alphabetically.
 * @param {Localized|null|undefined} value
 * @returns {string[]}
 */
export function languagesOf(value) {
  throw new Error('TODO(T4): languagesOf');
}
