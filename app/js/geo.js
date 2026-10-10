// Pure geography helpers. Works offline: no map tiles, no network.

/** @typedef {import('./types.js').LatLng} LatLng */
/** @typedef {import('./types.js').Place} Place */

/**
 * Great-circle distance (haversine).
 * @param {LatLng} a
 * @param {LatLng} b
 * @returns {number} kilometres
 */
export function km(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Human distance: 0.35 → "350 m", 2.34 → "2.3 km", 12.6 → "13 km".
 * @param {number} d  kilometres
 * @returns {string}
 */
export function fmtKm(d) {
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0)} km`;
}

/**
 * Distance from pos to a place, or null when there is no position.
 * @param {Place} place
 * @param {LatLng|null} pos
 * @returns {number|null} kilometres
 */
export function distanceTo(place, pos) {
  return pos ? km(pos, place.location.coordinates) : null;
}

/**
 * Places sorted nearest first. Without a position, returns the input order (as a copy).
 * @param {Place[]} places
 * @param {LatLng|null} pos
 * @returns {Place[]}
 */
export function sortByDistance(places, pos) {
  if (!pos) return [...places];
  return [...places].sort((a, b) => distanceTo(a, pos) - distanceTo(b, pos));
}

/**
 * Deep links that hand navigation to the phone's map app.
 * @param {Place} place
 * @returns {{ google: string, apple: string }}
 */
export function mapsLinks(place) {
  const { lat, lng } = place.location.coordinates;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(place.name.zh_TW)}`,
  };
}
