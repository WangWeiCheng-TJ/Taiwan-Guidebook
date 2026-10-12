// Places open all day every day (foreign_visitor_guide.always_open) get no opening-hours phrases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { phrasesForPlace } from '../../app/js/phrases.js';
import { guidebook, places, chihkan } from '../fixtures.js';

// The flag on "closing-time" comes from data/phrases.json; set it here too, so this test does not depend on the data.
const phrases = guidebook.phrases.map(p => (p.id === 'closing-time' ? { ...p, hours: true } : p));
const withGuide = (place, extra) => ({ ...place, foreign_visitor_guide: { ...place.foreign_visitor_guide, ...extra } });
const ids = list => list.map(p => p.id);

test('a place with opening hours can be asked when it closes', () => {
  assert.ok(ids(phrasesForPlace(withGuide(chihkan, { always_open: false }), phrases, 99)).includes('closing-time'));
  assert.ok(ids(phrasesForPlace(chihkan, phrases, 99)).includes('closing-time'));
});

test('an always-open place gets no hours phrases, and keeps the others', () => {
  const open = phrasesForPlace(withGuide(chihkan, { always_open: true }), phrases, 99);
  assert.ok(!open.some(p => p.hours));
  const normal = phrasesForPlace(withGuide(chihkan, { always_open: false }), phrases, 99);
  // Same phrases minus closing-time (the round-robin order between categories may shift, so compare as sets)
  assert.deepEqual(ids(open).sort(), ids(normal).filter(id => id !== 'closing-time').sort());
});

test('always_open and free_entry filter independently', () => {
  const both = phrasesForPlace(withGuide(chihkan, { always_open: true, free_entry: true }), phrases, 99);
  assert.ok(!both.some(p => p.hours || p.ticket));
  const freeOnly = phrasesForPlace(withGuide(chihkan, { free_entry: true }), phrases, 99);
  assert.ok(ids(freeOnly).includes('closing-time'));
  assert.ok(!freeOnly.some(p => p.ticket));
});

test('bundle: no always-open place is offered an hours phrase', () => {
  for (const p of places.filter(x => x.foreign_visitor_guide?.always_open === true)) {
    assert.ok(!phrasesForPlace(p, guidebook.phrases, 99).some(ph => ph.hours), p.id);
  }
});
