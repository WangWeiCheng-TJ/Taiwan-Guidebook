// Pure geography helpers. Distances work offline; the OpenStreetMap URLs need a connection to open.

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
 * The unit is chosen after rounding, so 0.9996 is "1.0 km" (not "1000 m") and 9.97 is "10 km" (not "10.0 km").
 * @param {number} d  kilometres
 * @returns {string}
 */
export function fmtKm(d) {
  const m = Math.round(d * 1000);
  if (m < 1000) return `${m} m`;
  const tenths = d.toFixed(1);
  return Number(tenths) < 10 ? `${tenths} km` : `${d.toFixed(0)} km`;
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
 * The distance to show the traveler: from a GPS position only, else null.
 * A picked city (source 'pick') is an area, not a point. Its position is the mean of the city's guidebook
 * places (cityCenter), which can lie between places tens of km apart (New Taipei: Tamsui and Ruifang), so a
 * distance from it would mislead (from the New Taipei centre, a Taipei City place is the nearest).
 * @param {Place} place
 * @param {import('./types.js').Pos|null} pos
 * @returns {number|null} kilometres
 */
export function gpsDistance(place, pos) {
  return pos && pos.source !== 'pick' ? distanceTo(place, pos) : null;
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

/**
 * A coordinate for a URL: at most 6 decimals (about 10 cm), so sums like 120.2026 - 0.006 don't print
 * as 120.19659999999999.
 * @param {number} x  degrees
 * @returns {string}
 */
function deg(x) {
  return String(Number(x.toFixed(6)));
}

/**
 * OpenStreetMap embed (an iframe src) with a marker on the point, about 1.2 km wide. Needs a connection:
 * the service worker never caches other sites.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function osmEmbedUrl(lat, lng) {
  const bbox = [lng - 0.006, lat - 0.004, lng + 0.006, lat + 0.004].map(deg).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

/**
 * The same point on openstreetmap.org, with a marker, at street zoom.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function osmLink(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
