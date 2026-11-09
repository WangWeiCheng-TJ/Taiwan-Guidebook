// A reload while a sheet or the show card was open (app/js/main.js in the fake browser, tests/fake-dom.js): the
// overlay is gone, and the first Back must leave the page, not land on the page's own entry with nothing to do
// (review: the first Back after such a reload was a dead press).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook, chihkan } from '../fixtures.js';

const place = '#/place/chihkan-tower';
const dom = installDom({ guidebook, stack: [
  { hash: '#/explore', state: { key: 'E' } },
  { hash: place, state: { key: 'K' } },
  { hash: place, state: { key: 'K', overlays: ['card'] } }, // the show card's entry, current when the tab reloaded
] });
await import('../../app/js/main.js');
await settle();

test('after the reload the tab stands on the page\'s own entry, with no overlay listed', () => {
  assert.equal(dom.at(), 1);
  assert.deepEqual(dom.history.state, { key: 'K' });
  assert.equal(dom.location.hash, place);
  assert.ok(dom.view.innerHTML.includes(chihkan.name.en), 'the place page is shown');
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.sheet.hidden, true);
});

test('the first Back then leaves the page', async () => {
  dom.history.back();
  await settle();
  assert.equal(dom.location.hash, '#/explore');
  assert.ok(dom.view.innerHTML.includes('data-action="city"'), 'Explore is shown');
});
