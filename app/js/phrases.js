// Which phrases to show where: category tiles on the Phrases tab, and suggestions on a place page.

/** @typedef {import('./types.js').Phrase & { top?: boolean }} Phrase */
/** @typedef {import('./types.js').Place} Place */

/** Tiles on the Phrases tab, in display order. "top" is the hand-picked most-used set. */
export const PHRASE_GROUPS = [
  { id: 'top', icon: '⭐' },
  { id: 'food', icon: '🍜' },
  { id: 'transport', icon: '🚕' },
  { id: 'shopping', icon: '🛍️' },
  { id: 'emergency', icon: '🆘' },
  { id: 'basics', icon: '👋' },
];

/**
 * Phrase categories likely to be needed at a kind of place, most relevant first.
 * Keys are attraction categories from schema/attraction.schema.json.
 */
const PLACE_PHRASES = {
  historic_street_district: ['food', 'shopping'],
  natural_cultural_landscape: ['food', 'transport'],
  industrial_heritage: ['food', 'transport'],
  temple_shrine: ['basics'],
  traditional_residence: ['basics'],
  indigenous_cultural_site: ['basics', 'food'],
  memorial_museum: ['basics', 'shopping'],
  historical_fortress: ['basics', 'shopping'],
  colonial_architecture: ['basics', 'shopping'],
};
const DEFAULT_PLACE_PHRASES = ['basics', 'transport'];

/**
 * Phrases in a group: "top" = phrases flagged top, otherwise phrases of that category. Data order is kept.
 * @param {Phrase[]} phrases
 * @param {string} group
 * @returns {Phrase[]}
 */
export function phrasesIn(phrases, group) {
  return group === 'top' ? phrases.filter(p => p.top) : phrases.filter(p => p.category === group);
}

/**
 * Up to n phrases useful at this place: categories from PLACE_PHRASES (default basics + transport),
 * in that order, most-used phrases first within each category.
 * @param {Place} place
 * @param {Phrase[]} phrases
 * @param {number} [n]
 * @returns {Phrase[]}
 */
export function phrasesForPlace(place, phrases, n = 5) {
  const cats = PLACE_PHRASES[place.category] || DEFAULT_PLACE_PHRASES;
  const ranked = cats.flatMap(c => {
    const inCat = phrases.filter(p => p.category === c);
    return [...inCat.filter(p => p.top), ...inCat.filter(p => !p.top)];
  });
  return ranked.slice(0, n);
}

/**
 * The tile a place's suggestions come from, for the "more" link.
 * @param {Place} place
 * @returns {string}
 */
export function mainGroupForPlace(place) {
  return (PLACE_PHRASES[place.category] || DEFAULT_PLACE_PHRASES)[0];
}
