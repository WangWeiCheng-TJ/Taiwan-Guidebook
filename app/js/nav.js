// Routing and history decisions for main.js. Pure: main.js does the DOM and history calls.

/** Routes that have a view: #/<route>[/<arg>]. */
export const ROUTES = ['explore', 'place', 'log', 'ask', 'phrases', 'tips', 'apps', 'learn'];

/** Pages without a tab of their own highlight the tab they are reached from. */
export const PARENT_TAB = { place: 'explore', apps: 'tips', learn: 'tips' };

/**
 * Route and argument of a location.hash. The argument is percent-decoded; a malformed escape (a truncated
 * link such as #/place/%E0) is kept as typed instead of throwing. An unknown route is Explore with
 * known = false, so main.js can put #/explore in the address bar.
 * @param {string} hash
 * @returns {{ tab: string, arg: string, known: boolean }}
 */
export function parseRoute(hash) {
  const [route = '', raw = ''] = String(hash || '').replace(/^#\/?/, '').split('/');
  if (!route) return { tab: 'explore', arg: '', known: true };
  if (!ROUTES.includes(route)) return { tab: 'explore', arg: '', known: false };
  let arg = raw;
  try { arg = decodeURIComponent(raw); } catch { /* malformed escape: keep it as typed */ }
  return { tab: route, arg, known: true };
}

/**
 * The tab bar entry to highlight for a route.
 * @param {string} tab  parseRoute(...).tab
 * @returns {string}
 */
export function activeTab(tab) {
  return PARENT_TAB[tab] || tab;
}

/** @param {unknown} st */
const fields = st => (st && typeof st === 'object' && !Array.isArray(st) ? /** @type {Record<string, unknown>} */ (st) : {});

// ---------- Scroll position per history entry ----------

/**
 * The key main.js stamped on a history entry, or null for an entry it has not seen yet (a new navigation).
 * @param {unknown} st  history.state
 * @returns {string|null}
 */
export function entryKey(st) {
  const k = fields(st).key;
  return typeof k === 'string' && k ? k : null;
}

/**
 * history.state with this key, keeping the entry's other fields.
 * @param {unknown} st
 * @param {string} key
 * @returns {Record<string, unknown>}
 */
export function withKey(st, key) {
  return { ...fields(st), key };
}

/**
 * Where to scroll after a route change: where the reader left a page they come back to (Back or Forward),
 * the top of a page opened anew.
 * @param {string|null} key  entryKey(history.state) of the entry landed on, before main.js stamps a new one
 * @param {Map<string, number>} saved  scrollY by entry key, recorded when leaving each entry
 * @returns {number}
 */
export function scrollFor(key, saved) {
  return key !== null && saved.has(key) ? /** @type {number} */ (saved.get(key)) : 0;
}

// ---------- Overlays (sheet, big card) in the history ----------
// Each open overlay has its own history entry (same URL), listing the tokens of the overlays open there,
// bottom first. Back leaves that entry, and main.js closes what the entry it lands on does not list.

/**
 * Tokens of the overlays open at a history entry, bottom first ([] for a page entry).
 * @param {unknown} st  history.state
 * @returns {string[]}
 */
export function entryOverlays(st) {
  const o = fields(st).overlays;
  return Array.isArray(o) ? o.filter(t => typeof t === 'string') : [];
}

/**
 * history.state for an entry with these overlays open, keeping its other fields (the scroll key).
 * @param {unknown} st
 * @param {string[]} tokens  bottom first; [] drops the field
 * @returns {Record<string, unknown>}
 */
export function withOverlays(st, tokens) {
  const { overlays: _drop, ...rest } = fields(st);
  return tokens.length ? { ...rest, overlays: [...tokens] } : rest;
}

/**
 * What to do when the history lands on an entry (popstate): close the open overlays above the ones the
 * entry lists, counted from the top. `stale` = the entry lists overlays that are no longer open (Forward
 * into an overlay closed earlier); main.js steps back off it so the next Back is not a dead press.
 * @param {string[]} open  tokens of the open overlays, bottom first
 * @param {string[]} kept  entryOverlays(history.state)
 * @returns {{ close: number, stale: boolean }}
 */
export function overlayChange(open, kept) {
  let i = 0;
  while (i < open.length && i < kept.length && open[i] === kept[i]) i++;
  return { close: open.length - i, stale: kept.length > i };
}

// ---------- Focus across a re-render ----------

/** Attributes that pick out the same control again after #view is re-rendered. */
const FOCUS_ATTRS = ['data-action', 'data-change', 'data-input', 'data-id', 'data-date', 'data-city', 'data-mode',
  'data-group', 'data-n', 'data-say', 'name', 'href'];

/** @param {string} v  a value for a double-quoted CSS string */
const cssString = v => v.replace(/["\\]/g, '\\$&').replace(/[\n\r\f]/g, c => `\\${c.charCodeAt(0).toString(16)} `);

/**
 * A CSS selector for the control with the same identifying attributes, so main.js can focus it again after a
 * re-render replaced it. "" when the element has none of them (nothing reliable to find).
 * @param {(name: string) => string|null} get  attribute reader, e.g. name => el.getAttribute(name)
 * @returns {string}
 */
export function focusSelector(get) {
  const parts = [];
  for (const a of FOCUS_ATTRS) {
    const v = get(a);
    if (v !== null && v !== undefined) parts.push(`[${a}="${cssString(String(v))}"]`);
  }
  if (get('type') === 'submit') parts.push('[type="submit"]');
  return parts.join('');
}
