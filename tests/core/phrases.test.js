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

test('a historic street suggests food first, most-used first, then mixes in its other categories', () => {
  const s = phrasesForPlace(byId('dadaocheng-dihua-street'), phrases);
  assert.equal(s.length, 5);
  assert.equal(s[0].category, 'food');
  assert.ok(s[0].top);
  assert.deepEqual(s.slice(0, 3).map(p => p.category), ['food', 'shopping', 'sightseeing']);
  assert.equal(mainGroupForPlace(byId('dadaocheng-dihua-street')), 'food');
});

test('a temple suggests sightseeing first, keeps the toilet question in the default 5, never generic phrases', () => {
  assert.ok(phrasesForPlace(byId('lukang-longshan-temple'), phrases).some(p => p.id === 'toilet'));
  const s = phrasesForPlace(byId('lukang-longshan-temple'), phrases, 99);
  assert.equal(s[0].category, 'sightseeing');
  assert.deepEqual([...new Set(s.map(p => p.category))], ['sightseeing', 'basics']);
  assert.ok(s.every(p => !p.generic));
  assert.ok(s.some(p => p.id === 'toilet'), 'the toilet question stays');
  assert.ok(!s.some(p => ['thank-you', 'excuse-me', 'no-chinese'].includes(p.id)));
});

test('free places get no ticket phrases', () => {
  for (const id of ['duiyue-gate', 'dadaocheng-dihua-street']) {
    assert.ok(!phrasesForPlace(byId(id), phrases, 99).some(p => p.ticket), id);
  }
  assert.ok(phrasesForPlace(byId('chihkan-tower'), phrases).some(p => p.ticket));
});

test('unknown categories fall back to sightseeing, basics, transport', () => {
  const s = phrasesForPlace({ category: 'something_new' }, phrases, 99);
  assert.deepEqual([...new Set(s.map(p => p.category))], ['sightseeing', 'basics', 'transport']);
});
