// A log entry whose place left the guidebook still has a name (audit: blank name in My trip and prompts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entryName } from '../../app/js/triplog.js';
import { logBlock } from '../../app/js/prompt.js';
import { places } from '../fixtures.js';

const gone = { id: 'x', date: '2026-11-03', placeId: 'gone-place', name: '', stars: 4, note: 'great' };

test('entryName falls back to the placeId when the place is not in the guidebook', () => {
  assert.equal(entryName(gone, places), 'gone-place');
  assert.equal(entryName({ ...gone, name: 'Old name' }, places), 'Old name');
  assert.equal(entryName({ ...gone, placeId: 'chihkan-tower' }, places), 'Chihkan Tower (Fort Provintia)');
  assert.equal(entryName({ ...gone, placeId: null, name: 'Curry shop' }, places), 'Curry shop');
});

test('logBlock names an entry whose place is gone', () => {
  assert.match(logBlock([gone], places), /- 2026-11-03, gone-place: 4\/5, great/);
});
