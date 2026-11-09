// My stay: where the traveler sleeps, to show a taxi driver ("Take me back"). Pure: no DOM, no storage
// (main.js writes STAY_KEY). Private by design: nothing here feeds a prompt or the log export.
// Contract tests: tests/core/stay.test.js

import { km } from './geo.js';

/** @typedef {import('./types.js').Stay} Stay */
/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./types.js').Pos} Pos */

export const STAY_KEY = 'tg.stay.v1';

const MAX = { name: 120, address: 200, phone: 40 };
const HAN = /[㐀-鿿豈-﫿]/;

/**
 * An empty My stay form.
 * @returns {Stay}
 */
export function emptyStay() {
  return { id: '', name: '', address: '', phone: '', city: '' };
}

/**
 * Pasted text tidied: runs of whitespace (line breaks from a booking e-mail) become one space, trimmed,
 * cut at `max` characters. Anything but a string gives "".
 * @param {unknown} x
 * @param {number} max
 * @returns {string}
 */
function clean(x, max) {
  return typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * A stay as stored, from a form draft or from storage: every field a tidied string (see clean; name at most
 * 120 characters, address 200, phone 40), missing or non-string fields "". null when `raw` is not an object.
 * Does not judge the content: see validateStay.
 * @param {unknown} raw
 * @returns {Stay|null}
 */
export function normalizeStay(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  return {
    id: typeof r.id === 'string' ? r.id.trim() : '',
    name: clean(r.name, MAX.name),
    address: clean(r.address, MAX.address),
    phone: clean(r.phone, MAX.phone),
    city: typeof r.city === 'string' ? r.city.trim() : '',
  };
}

/**
 * Why a (normalized) stay cannot be saved, or null if it can. Needs a name and an address with Chinese in it
 * (the card is for a driver who reads Chinese); a phone, when given, must make a tel: link (telHref).
 * @param {Stay} stay
 * @returns {string|null} user-facing message (English; lang.js trMsg translates it)
 */
export function validateStay(stay) {
  if (!stay.name) return "Paste the hotel's name.";
  if (!stay.address) return "Paste the hotel's address in Chinese.";
  if (!HAN.test(stay.address)) return 'The address has no Chinese in it. Paste the Chinese one: that is what a driver reads.';
  if (stay.phone && !telHref(stay.phone)) return 'Check the phone number, or leave it empty.';
  return null;
}

/**
 * The stays kept in storage, re-validated (storage may hold an old or damaged list): entries that do not
 * normalize, have no id or fail validateStay are dropped, and so is a second entry with the same id.
 * @param {unknown} raw  readJSON(STAY_KEY, [])
 * @returns {Stay[]}
 */
export function readStays(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  /** @type {Stay[]} */
  const out = [];
  for (const x of raw) {
    const s = normalizeStay(x);
    if (!s || !s.id || seen.has(s.id) || validateStay(s)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/**
 * A tel: link for a phone number as pasted, or "" when it is not one. Full-width digits and ＋ (from Chinese
 * text) count as ASCII; an extension after #, "ext", 分機 or 轉 is dropped, and so is a "(0)" trunk prefix
 * written after a country code; the rest keeps only its digits, with a leading + kept. 6 to 15 digits.
 * "(02) 2311-1234" → "tel:0223111234", "+886 (0)6 221 0000" → "tel:+88662210000".
 * @param {string} phone
 * @returns {string}
 */
export function telHref(phone) {
  const s = String(phone ?? '')
    .replace(/[０-９＋]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .split(/#|ext|分機|轉/i)[0]
    .replace(/\(0\)/g, '')
    .trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return '';
  return `tel:${s.startsWith('+') ? '+' : ''}${digits}`;
}

/**
 * What the stay card's 🔊 reads aloud: the name, then the address (a pause between), as driverSay does.
 * @param {Stay} stay
 * @returns {string}
 */
export function staySay(stay) {
  return [stay.name, stay.address].filter(Boolean).join('，');
}

/**
 * The guidebook city (city_en) an address is in: the city whose Chinese name (city_zh, 台 and 臺 alike)
 * appears earliest in it. "" when none does.
 * "100台北市中正區…" → "Taipei City"; "新北市板橋區…" → "New Taipei City".
 * @param {string} address
 * @param {Place[]} places
 * @returns {string}
 */
export function cityFromAddress(address, places) {
  const norm = (/** @type {string} */ s) => s.replace(/台/g, '臺');
  const a = norm(address || '');
  /** @type {Map<string, string>} */
  const zh = new Map();
  for (const p of places) if (p.location.city_zh) zh.set(p.location.city_en, norm(p.location.city_zh));
  let best = '';
  let at = Infinity;
  for (const [en, name] of zh) {
    const i = a.indexOf(name);
    if (i >= 0 && i < at) { best = en; at = i; }
  }
  return best;
}

/**
 * The stay's city: the one the traveler picked, else the one in its address (cityFromAddress), else "".
 * @param {Stay} stay
 * @param {Place[]} places
 * @returns {string}  city_en or ""
 */
export function stayCity(stay, places) {
  return stay.city || cityFromAddress(stay.address, places);
}

/**
 * The stay in a city: the last saved one the traveler put in that city, else the last saved one whose
 * address is there (and that has no city picked). null when none.
 * @param {Stay[]} stays
 * @param {string} city  city_en
 * @param {Place[]} places
 * @returns {Stay|null}
 */
export function stayForCity(stays, city, places) {
  if (!city) return null;
  const picked = stays.filter(s => s.city === city);
  if (picked.length) return picked[picked.length - 1];
  const found = stays.filter(s => !s.city && cityFromAddress(s.address, places) === city);
  return found.length ? found[found.length - 1] : null;
}

/**
 * The stay nearest to a position. A stay has no coordinates of its own: its distance is that from `pos` to
 * the nearest guidebook place in the stay's city (stayCity). Stays with no known city, or a city with no
 * guidebook places, are left out; on a tie the later saved one wins. null when none is left.
 * @param {Stay[]} stays
 * @param {import('./types.js').LatLng} pos
 * @param {Place[]} places
 * @returns {Stay|null}
 */
export function stayNear(stays, pos, places) {
  let best = null;
  let bestKm = Infinity;
  for (const s of stays) {
    const city = stayCity(s, places);
    if (!city) continue;
    for (const p of places) {
      if (p.location.city_en !== city) continue;
      const d = km(pos, p.location.coordinates);
      if (d < bestKm || (d === bestKm && best !== s)) { best = s; bestKm = d; }
    }
  }
  return best;
}

/**
 * The stay Explore offers "Take me back" for. One stay: that one, wherever the traveler is. Several: with a
 * picked city, the stay in that city (stayForCity); otherwise, or when that city has none, the stay nearest
 * the position (stayNear; a picked city's position is its centre). No position and several stays: null,
 * since a wrong hotel on a driver's card is worse than none (My trip lists them all).
 * @param {Stay[]} stays
 * @param {Pos|null} pos
 * @param {Place[]} places
 * @returns {Stay|null}
 */
export function stayHere(stays, pos, places) {
  if (stays.length <= 1) return stays[0] || null;
  if (!pos) return null;
  const inCity = pos.source === 'pick' && pos.city ? stayForCity(stays, pos.city, places) : null;
  return inCity || stayNear(stays, pos, places);
}

/**
 * Save a stay: one per city. An existing stay with the same id is replaced where it is (an edit); a new one
 * goes last. Any other stay in the same city (stayCity) is dropped and returned in `replaced`, so the
 * caller can ask first. A stay with no known city replaces nothing.
 * @param {Stay[]} stays
 * @param {Stay} stay  validated, with its id set
 * @param {Place[]} places
 * @returns {{ stays: Stay[], replaced: Stay[] }}
 */
export function putStay(stays, stay, places) {
  const city = stayCity(stay, places);
  const replaced = city ? stays.filter(s => s.id !== stay.id && stayCity(s, places) === city) : [];
  const kept = stays.filter(s => !replaced.includes(s));
  const out = kept.some(s => s.id === stay.id) ? kept.map(s => (s.id === stay.id ? stay : s)) : [...kept, stay];
  return { stays: out, replaced };
}

/**
 * @param {Stay[]} stays
 * @param {string} id
 * @returns {Stay[]} new array without that stay
 */
export function removeStay(stays, id) {
  return stays.filter(s => s.id !== id);
}
