// Which phrases to show where: category tiles on the Phrases tab, and suggestions on a place page.

/** @typedef {import('./types.js').Phrase} Phrase */
/** @typedef {import('./types.js').Place} Place */

/** Tiles on the Phrases tab, in display order. "top" is the hand-picked most-used set. */
export const PHRASE_GROUPS = [
  { id: 'top', icon: '⭐' },
  { id: 'sightseeing', icon: '🎫' },
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
  historic_street_district: ['food', 'shopping', 'sightseeing'],
  natural_cultural_landscape: ['food', 'sightseeing', 'transport'],
  industrial_heritage: ['sightseeing', 'food', 'transport'],
  temple_shrine: ['sightseeing', 'basics'],
  traditional_residence: ['sightseeing', 'basics'],
  indigenous_cultural_site: ['sightseeing', 'basics', 'food'],
  memorial_museum: ['sightseeing', 'basics'],
  historical_fortress: ['sightseeing', 'basics'],
  colonial_architecture: ['sightseeing', 'basics'],
};
const DEFAULT_PLACE_PHRASES = ['sightseeing', 'basics', 'transport'];

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
 * Up to n phrases useful at this place, taken from the categories in PLACE_PHRASES in turns
 * (first category first in each round), most-used phrases first within a category, so every
 * relevant category gets a say. Generic phrases (hello, thank you...) are skipped: they are useful
 * everywhere, so they say nothing about this place. Ticket phrases are skipped at free places
 * (foreign_visitor_guide.free_entry, or a historic street).
 * @param {Place} place
 * @param {Phrase[]} phrases
 * @param {number} [n]
 * @returns {Phrase[]}
 */
export function phrasesForPlace(place, phrases, n = 5) {
  const cats = PLACE_PHRASES[place.category] || DEFAULT_PLACE_PHRASES;
  const free = place.foreign_visitor_guide?.free_entry === true || place.category === 'historic_street_district';
  const queues = cats.map(c => {
    const inCat = phrases.filter(p => p.category === c && !p.generic && !(free && p.ticket));
    return [...inCat.filter(p => p.top), ...inCat.filter(p => !p.top)];
  });
  const out = [];
  while (out.length < n && queues.some(q => q.length)) {
    for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  }
  return out;
}

/**
 * The tile a place's suggestions come from, for the "more" link.
 * @param {Place} place
 * @returns {string}
 */
export function mainGroupForPlace(place) {
  return (PLACE_PHRASES[place.category] || DEFAULT_PLACE_PHRASES)[0];
}
