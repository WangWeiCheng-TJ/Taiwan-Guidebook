// Pure helpers: text, dates. No DOM, no state.

/**
 * Escape a value for safe insertion into HTML text or a quoted attribute.
 * @param {unknown} s  any value; null/undefined become ""
 * @returns {string}
 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Shorten text to at most n characters, ending with "…" when cut.
 * @param {string|null|undefined} s
 * @param {number} n  max length including the ellipsis
 * @returns {string}
 */
export function clip(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/**
 * Local calendar date as YYYY-MM-DD (not UTC).
 * @param {Date} [now]
 * @returns {string}
 */
export function today(now = new Date()) {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} iso  YYYY-MM-DD
 * @param {number} n    days to add, may be negative
 * @returns {string}    YYYY-MM-DD
 */
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Whole days from a to b (b - a).
 * @param {string} a  YYYY-MM-DD
 * @param {string} b  YYYY-MM-DD
 * @returns {number}
 */
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

/**
 * Star string for a rating: 3 → "★★★☆☆"; 0/null → "".
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function stars(n) {
  return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
}

/**
 * "daily-life" → "Daily Life", "food" → "Food".
 * @param {string} slug
 * @returns {string}
 */
export function titleCase(slug) {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
