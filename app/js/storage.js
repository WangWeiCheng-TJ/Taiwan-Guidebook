// localStorage wrappers. Storage can be blocked (private mode) or full, so nothing here throws.

/**
 * @template T
 * @param {string} key
 * @param {T} fallback  returned when the key is missing, unreadable or not JSON
 * @returns {T}
 */
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value  must be JSON-serialisable
 * @returns {boolean} false when the write failed (caller decides whether to tell the user)
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
