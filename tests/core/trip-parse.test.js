// parseTrip with the kinds of JSON an AI really writes (audit findings on trip.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrip } from '../../app/js/trip.js';
import { planFromAiText } from '../../app/js/aiplan.js';
import { places } from '../fixtures.js';

test('parseTrip: null optional fields count as absent', () => {
  const { trip, errors } = parseTrip({
    title: 'Tainan day',
    days: [{
      date: '2026-11-04', title: null, items: [
        { time: '09:00', place: 'chihkan-tower', name: null, note: 'go early' },
        { time: '12:00', place: null, name: 'Lunch at a beef soup shop', note: null },
        { time: null, name: 'Evening walk' },
      ],
    }],
  });
  assert.deepEqual(errors, []);
  assert.equal('title' in trip.days[0], false);
  assert.deepEqual(trip.days[0].items, [
    { place: 'chihkan-tower', time: '09:00', note: 'go early' },
    { name: 'Lunch at a beef soup shop', time: '12:00' },
    { name: 'Evening walk' },
  ]);
});

test('parseTrip: an item with place and name both null still needs one of them', () => {
  const { trip, errors } = parseTrip({ title: 'T', days: [{ date: '2026-11-04', items: [{ place: null, name: null }] }] });
  assert.equal(trip, null);
  assert.deepEqual(errors, ['Day 1, stop 1: needs a place id or a name.']);
});

test('parseTrip: a one-digit hour is padded; other bad times are still rejected', () => {
  const { trip, errors } = parseTrip({ title: 'T', days: [{ date: '2026-11-04', items: [{ name: 'a', time: '9:30' }] }] });
  assert.deepEqual(errors, []);
  assert.equal(trip.days[0].items[0].time, '09:30');
  for (const bad of ['9am', '24:00', '9:5', '930', '09:60', 930]) {
    const r = parseTrip({ title: 'T', days: [{ date: '2026-11-04', items: [{ name: 'a', time: bad }] }] });
    assert.equal(r.trip, null, String(bad));
  }
});

test('planFromAiText loads an AI answer that uses null for optional keys', () => {
  const answer = '```json\n{"title":"Tainan day","days":[{"date":"2026-11-04","items":[' +
    '{"time":"09:00","place":"chihkan-tower","name":null,"note":"go early"},' +
    '{"time":"12:00","place":null,"name":"Lunch at a beef soup shop","note":null}]}]}\n```';
  const { trip, errors } = planFromAiText(answer, places);
  assert.deepEqual(errors, []);
  assert.equal(trip.days[0].items.length, 2);
  assert.equal(trip.days[0].items[0].place, 'chihkan-tower');
});
