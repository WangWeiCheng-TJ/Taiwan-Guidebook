// Knowledge topics (#/learn): which topics belong to a place, and which places to a topic. Pure.
// A topic names places outright (topic.places) and by tag (topic.tags, matched against Place.tags).

/** @typedef {import('./types.js').Topic} Topic */
/** @typedef {import('./types.js').Place} Place */

/**
 * @param {Topic[]|undefined} topics  guidebook.topics (missing in older bundles)
 * @param {string} id
 * @returns {Topic|undefined}
 */
export function topicById(topics, id) {
  return (topics || []).find(t => t.id === id);
}

/**
 * Code-point order, the same as the build's sorted() in Python.
 * @param {{ id: string }} a
 * @param {{ id: string }} b
 * @returns {number}
 */
function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Does any of these tags appear in the set?
 * @param {string[]|undefined} tags
 * @param {Set<string>} set
 * @returns {boolean}
 */
function sharesTag(tags, set) {
  return (tags || []).some(t => set.has(t));
}

/**
 * Topics to read about at a place: topics that list the place id first, then topics sharing a tag
 * with it; each group sorted by id, each topic once.
 * @param {Place} place
 * @param {Topic[]|undefined} topics  guidebook.topics
 * @returns {Topic[]}
 */
export function topicsForPlace(place, topics) {
  const all = [...(topics || [])].sort(byId);
  const tags = new Set(place.tags || []);
  const listed = all.filter(t => (t.places || []).includes(place.id));
  const tagged = all.filter(t => !listed.includes(t) && sharesTag(t.tags, tags));
  return [...listed, ...tagged];
}

/**
 * Places related to a topic: the places it lists (in its order; unknown ids skipped), then other
 * places sharing a tag with it (guidebook order); each place once.
 * @param {Topic} topic
 * @param {Place[]} places  guidebook order
 * @returns {Place[]}
 */
export function placesForTopic(topic, places) {
  const listed = [...new Set(topic.places || [])].map(id => places.find(p => p.id === id)).filter(p => p !== undefined);
  const tags = new Set(topic.tags || []);
  const tagged = places.filter(p => !listed.includes(p) && sharesTag(p.tags, tags));
  return [...listed, ...tagged];
}
