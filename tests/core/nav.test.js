// Routing and history decisions (app/js/nav.js): audit ui #3 (Back keeps the scroll position), #4 (Back closes
// an open sheet or big card first), #9 (malformed escapes and unknown routes), #10 (focus after a re-render).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTES, PARENT_TAB, parseRoute, activeTab, entryKey, withKey, scrollFor,
  entryOverlays, withOverlays, overlayChange, focusSelector,
} from '../../app/js/nav.js';

test('parseRoute: route and decoded argument', () => {
  assert.deepEqual(parseRoute('#/place/chihkan-tower'), { tab: 'place', arg: 'chihkan-tower', known: true });
  assert.deepEqual(parseRoute('#/learn/folk%20religion'), { tab: 'learn', arg: 'folk religion', known: true });
  assert.deepEqual(parseRoute('#/phrases'), { tab: 'phrases', arg: '', known: true });
  for (const empty of ['', '#', '#/']) assert.deepEqual(parseRoute(empty), { tab: 'explore', arg: '', known: true });
});

test('parseRoute: a malformed escape is kept as typed instead of throwing', () => {
  assert.throws(() => decodeURIComponent('%E0'), URIError); // what used to stop the app on "Loading…"
  assert.deepEqual(parseRoute('#/place/%E0'), { tab: 'place', arg: '%E0', known: true });
  assert.deepEqual(parseRoute('#/learn/100%'), { tab: 'learn', arg: '100%', known: true });
});

test('parseRoute: an unknown route is Explore, flagged so the address bar can be corrected', () => {
  assert.deepEqual(parseRoute('#/foo'), { tab: 'explore', arg: '', known: false });
  assert.deepEqual(parseRoute('#/foo/%E0'), { tab: 'explore', arg: '', known: false });
  for (const r of ROUTES) assert.equal(parseRoute(`#/${r}`).known, true, r);
});

test('activeTab: pages without a tab highlight their parent; every route highlights a tab', () => {
  assert.equal(activeTab('place'), 'explore');
  assert.equal(activeTab('apps'), 'tips');
  assert.equal(activeTab('learn'), 'tips');
  assert.equal(activeTab('log'), 'log');
  const tabs = ['explore', 'log', 'ask', 'phrases', 'tips'];
  for (const r of ROUTES) assert.ok(tabs.includes(activeTab(r)), r);
  for (const parent of Object.values(PARENT_TAB)) assert.ok(tabs.includes(parent));
});

test('entryKey / withKey: a key stamped on history.state, other fields kept', () => {
  assert.equal(entryKey(null), null);
  assert.equal(entryKey({}), null);
  assert.equal(entryKey({ key: '' }), null);
  assert.equal(entryKey({ key: 7 }), null);
  assert.equal(entryKey('a string'), null);
  assert.equal(entryKey({ key: 'k1' }), 'k1');
  assert.deepEqual(withKey(null, 'k1'), { key: 'k1' });
  assert.deepEqual(withKey({ overlays: ['t'], key: 'old' }, 'k2'), { overlays: ['t'], key: 'k2' });
});

test('scrollFor: back to a page seen before restores its position; a new page starts at the top', () => {
  const saved = new Map([['explore', 1840], ['place', 0]]);
  assert.equal(scrollFor('explore', saved), 1840);
  assert.equal(scrollFor('place', saved), 0);
  assert.equal(scrollFor(null, saved), 0, 'new entry: top');
  assert.equal(scrollFor('from-before-a-reload', saved), 0, 'known entry, nothing saved: top');
});

test('entryOverlays / withOverlays: the overlay list on an entry, the scroll key kept', () => {
  assert.deepEqual(entryOverlays(null), []);
  assert.deepEqual(entryOverlays({ key: 'k' }), []);
  assert.deepEqual(entryOverlays({ overlays: 'x' }), []);
  assert.deepEqual(entryOverlays({ overlays: ['a', 3, 'b'] }), ['a', 'b']);
  assert.deepEqual(withOverlays({ key: 'k' }, ['a']), { key: 'k', overlays: ['a'] });
  assert.deepEqual(withOverlays({ key: 'k', overlays: ['a'] }, []), { key: 'k' }, 'none: field dropped');
  assert.deepEqual(withOverlays(null, []), {});
  const tokens = ['a'];
  const st = withOverlays(null, tokens);
  tokens.push('b');
  assert.deepEqual(st.overlays, ['a'], 'a copy, not the caller\'s array');
});

test('overlayChange: Back from an overlay\'s entry closes that overlay only', () => {
  assert.deepEqual(overlayChange(['sheet'], []), { close: 1, stale: false });
  assert.deepEqual(overlayChange(['sheet', 'big'], ['sheet']), { close: 1, stale: false }, 'big card over a sheet');
  assert.deepEqual(overlayChange(['sheet', 'big'], []), { close: 2, stale: false }, 'Back two entries at once');
  assert.deepEqual(overlayChange([], []), { close: 0, stale: false }, 'page to page');
  assert.deepEqual(overlayChange(['sheet'], ['sheet']), { close: 0, stale: false });
});

test('overlayChange: an entry listing overlays that are no longer open is stale', () => {
  // Forward into the entry of a sheet closed earlier: nothing to reopen, step back off it
  assert.deepEqual(overlayChange([], ['t1']), { close: 0, stale: true });
  // A new sheet opened on such an entry, then closed: Back lands on the old entry, which does not list it
  assert.deepEqual(overlayChange(['t2'], ['t1']), { close: 1, stale: true });
});

test('focusSelector: finds the same control after a re-render', () => {
  const el = attrs => name => (name in attrs ? attrs[name] : null);
  assert.equal(focusSelector(el({ 'data-action': 'party-inc' })), '[data-action="party-inc"]');
  assert.equal(focusSelector(el({ 'data-action': 'city', 'data-city': 'Tainan City', class: 'chip on' })),
    '[data-action="city"][data-city="Tainan City"]', 'class is not identifying (it changes with the state)');
  assert.equal(focusSelector(el({ 'data-action': 'trip-day', 'data-date': '2026-11-04' })), '[data-action="trip-day"][data-date="2026-11-04"]');
  assert.equal(focusSelector(el({ 'data-change': 'area' })), '[data-change="area"]');
  assert.equal(focusSelector(el({ name: 'note' })), '[name="note"]');
  assert.equal(focusSelector(el({ href: '#/place/chihkan-tower', class: 'card' })), '[href="#/place/chihkan-tower"]');
  assert.equal(focusSelector(el({ type: 'submit', class: 'btn primary' })), '[type="submit"]');
  assert.equal(focusSelector(el({ type: 'button' })), '', 'type="button" alone matches any button');
  assert.equal(focusSelector(el({})), '');
});

test('focusSelector: a radio button is found by its value, or focus would jump to the first one of its group', () => {
  const el = attrs => name => (name in attrs ? attrs[name] : null);
  const radio = value => el({ type: 'radio', name: 'photo-kind', value, 'data-change': 'photo-kind' });
  assert.equal(focusSelector(radio('board')), '[data-change="photo-kind"][name="photo-kind"][value="board"]');
  assert.notEqual(focusSelector(radio('board')), focusSelector(radio('menu')));
  assert.equal(focusSelector(el({ type: 'radio', name: 'x' })), '[name="x"]', 'no value attribute: nothing to add');
  // A text field's value attribute is only the markup's default and changes with each render: never part of it
  assert.equal(focusSelector(el({ type: 'text', name: 'note', value: 'abc' })), '[name="note"]');
  assert.equal(focusSelector(el({ name: 'note', value: 'abc' })), '[name="note"]');
});

test('focusSelector: quotes, backslashes and line breaks in values stay inside the CSS string', () => {
  const sel = focusSelector(n => (n === 'data-id' ? 'a"b\\c\nd' : null));
  assert.equal(sel, '[data-id="a\\"b\\\\c\\a d"]');
});
