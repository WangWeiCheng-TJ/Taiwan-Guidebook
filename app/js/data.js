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

/**
 * Rough centre of a city: the average coordinates of its guidebook places.
 * Used when the user picks a city instead of sharing GPS.
 * @param {Place[]} places
 * @param {string} city  city_en
 * @returns {import('./types.js').LatLng|null}  null when the city has no places
 */
export function cityCenter(places, city) {
  const pts = places.filter(p => p.location.city_en === city).map(p => p.location.coordinates);
  if (!pts.length) return null;
  return { lat: pts.reduce((s, c) => s + c.lat, 0) / pts.length, lng: pts.reduce((s, c) => s + c.lng, 0) / pts.length };
}

/**
 * @typedef {import('./types.js').FoodPick} FoodPick
 * @typedef {import('./types.js').FoodCity} FoodCity
 */

/**
 * The owner's food picks for a city ([] when none).
 * @param {FoodCity[]|undefined} food  guidebook.food
 * @param {string|null|undefined} city city_en
 * @returns {FoodCity|null}
 */
export function foodFor(food, city) {
  return (food || []).find(c => c.city_en === city) || null;
}

/**
 * Google Maps search by name + city (the picks have no coordinates); opens the Maps app on phones.
 * @param {FoodPick} pick
 * @param {FoodCity} city
 * @returns {string}
 */
export function foodMapsLink(pick, city) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pick.name} ${city.city_zh}`)}`;
}
