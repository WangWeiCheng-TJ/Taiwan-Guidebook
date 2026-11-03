// A plan with two days on the same date shows every stop (audit logic #6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrip, tripDayFor, tripBlock } from '../../app/js/trip.js';
import { planFromAiText } from '../../app/js/aiplan.js';
import { places } from '../fixtures.js';

test('parseTrip: days that share a date become one day with all their stops, in order', () => {
  const { trip, errors } = parseTrip({ title: 'T', days: [
    { date: '2026-11-05', items: [{ name: 'C' }] },
    { date: '2026-11-04', title: 'Morning', items: [{ name: 'A', time: '09:00' }] },
    { date: '2026-11-04', title: 'Afternoon', items: [{ name: 'B', time: '14:00' }] },
  ] });
  assert.deepEqual(errors, []);
  assert.deepEqual(trip.days.map(d => d.date), ['2026-11-04', '2026-11-05']);
  const day = tripDayFor(trip, '2026-11-04');
  assert.equal(day.title, 'Morning / Afternoon');
  assert.deepEqual(day.items, [{ name: 'A', time: '09:00' }, { name: 'B', time: '14:00' }]);
  assert.equal(tripBlock(trip, places, '2026-11-04'), 'My plan for 2026-11-04 (Morning / Afternoon):\n- 09:00 A\n- 14:00 B');
});

test('parseTrip: merged titles skip blanks and repeats', () => {
  const merged = days => parseTrip({ title: 'T', days }).trip.days;
  const noTitle = merged([{ date: '2026-11-04', items: [{ name: 'A' }] }, { date: '2026-11-04', title: 'Old town', items: [] }]);
  assert.equal(noTitle.length, 1);
  assert.equal(noTitle[0].title, 'Old town');
  const same = merged([{ date: '2026-11-04', title: 'Old town', items: [] }, { date: '2026-11-04', title: 'Old town', items: [{ name: 'B' }] }]);
  assert.equal(same[0].title, 'Old town');
  assert.deepEqual(same[0].items, [{ name: 'B' }]);
  const neither = merged([{ date: '2026-11-04', items: [] }, { date: '2026-11-04', items: [] }]);
  assert.deepEqual(neither, [{ date: '2026-11-04', items: [] }]);
});

test('parseTrip: a bad second day with a repeated date is still reported under its own number', () => {
  const { trip, errors } = parseTrip({ title: 'T', days: [
    { date: '2026-11-04', items: [{ name: 'A' }] },
    { date: '2026-11-04', items: [{ time: '09:00' }] },
  ] });
  assert.equal(trip, null);
  assert.deepEqual(errors, ['Day 2, stop 1: needs a place id or a name.']);
});

test('planFromAiText: an AI answer that splits one date in two keeps both halves', () => {
  const answer = '```json\n' + JSON.stringify({ title: 'Tainan', days: [
    { date: '2026-11-04', items: [{ place: 'chihkan-tower' }] },
    { date: '2026-11-04', items: [{ name: 'Confucius Temple' }] },
  ] }) + '\n```';
  const { trip, errors } = planFromAiText(answer, places);
  assert.deepEqual(errors, []);
  assert.equal(trip.days.length, 1);
  assert.deepEqual(trip.days[0].items.map(i => i.place || i.name), ['chihkan-tower', 'Confucius Temple']);
});
