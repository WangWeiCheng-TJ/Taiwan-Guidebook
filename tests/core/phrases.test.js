import test from 'node:test';
import assert from 'node:assert/strict';
import { PHRASE_GROUPS, phrasesIn, phrasesForPlace, mainGroupForPlace } from '../../app/js/phrases.js';
import { guidebook, places } from '../fixtures.js';

const { phrases } = guidebook;
const byId = id => places.find(p => p.id === id);

test('every group has phrases, and the top set is small', () => {
  for (const g of PHRASE_GROUPS) assert.ok(phrasesIn(phrases, g.id).length > 0, g.id);
  const top = phrasesIn(phrases, 'top');
  assert.ok(top.length >= 5 && top.length <= 10, `top has ${top.length}`);
});

test('a historic street suggests food first, most-used first', () => {
  const s = phrasesForPlace(byId('dadaocheng-dihua-street'), phrases);
  assert.equal(s.length, 5);
  assert.ok(s.every(p => p.category === 'food'));
  assert.ok(s[0].top);
  assert.equal(mainGroupForPlace(byId('dadaocheng-dihua-street')), 'food');
});

test('a temple suggests basics; unknown categories fall back to basics + transport', () => {
  assert.ok(phrasesForPlace(byId('lukang-longshan-temple'), phrases).every(p => p.category === 'basics'));
  const s = phrasesForPlace({ category: 'something_new' }, phrases, 99);
  assert.deepEqual([...new Set(s.map(p => p.category))], ['basics', 'transport']);
});
