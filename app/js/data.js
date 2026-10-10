// Loading and querying the guidebook bundle. Query functions are pure.

/** @typedef {import('./types.js').Guidebook} Guidebook */
/** @typedef {import('./types.js').Place} Place */

/**
 * Fetch the bundle. The service worker serves it from cache when offline.
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<Guidebook>}
 * @throws {Error} when the response is not OK or not JSON
 */
export async function loadGuidebook(fetchFn = fetch) {
  const res = await fetchFn('data/guidebook.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {Place[]} places
 * @param {string} id
 * @returns {Place|undefined}
 */
export function placeById(places, id) {
  return places.find(p => p.id === id);
}

/**
 * Distinct city_en values, sorted.
 * @param {Place[]} places
 * @returns {string[]}
 */
export function cities(places) {
  return [...new Set(places.map(p => p.location.city_en))].sort();
}

/**
 * Distinct district_en values within one city, sorted.
 * @param {Place[]} places
 * @param {string} city  city_en
 * @returns {string[]}
 */
export function districtsOf(places, city) {
  return [...new Set(places.filter(p => p.location.city_en === city).map(p => p.location.district_en))].sort();
}
