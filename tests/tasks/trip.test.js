// Contract for TASK T1 (app/js/trip.js). Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrip, resolveItem, tripDayFor, tripUrlFrom, loadTrip, tripBlock } from '../../app/js/trip.js';
import { places } from '../fixtures.js';

const good = {
  title: ' Markus in Taiwan ',
  extra: 'dropped',
  days: [
    { date: '2026-11-05', items: [] },
    {
      date: '2026-11-04', title: 'Old Taipei', items: [
        { place: 'dadaocheng-dihua-street', time: '09:30', note: 'tea first', junk: 1 },
        { name: ' Curry shop ' },
        { place: 'not-in-guidebook', name: 'Secret spot' },
      ],
    },
  ],
};

test('parseTrip accepts a valid trip, cleans it and sorts days', () => {
  const { trip, errors } = parseTrip(good);
  assert.deepEqual(errors, []);
  assert.equal(trip.title, 'Markus in Taiwan');
  assert.equal('extra' in trip, false);
  assert.deepEqual(trip.days.map(d => d.date), ['2026-11-04', '2026-11-05']);
  assert.deepEqual(trip.days[0].items[0], { place: 'dadaocheng-dihua-street', time: '09:30', note: 'tea first' });
  assert.deepEqual(trip.days[0].items[1], { name: 'Curry shop' });
});

test('parseTrip rejects bad input with messages and a null trip', () => {
  for (const bad of [
    null, 'x', [], {},
    { title: '', days: [{ date: '2026-11-04', items: [] }] },
    { title: 'T', days: [] },
    { title: 'T', days: [{ date: '4 Nov', items: [] }] },
    { title: 'T', days: [{ date: '2026-11-04' }] },
    { title: 'T', days: [{ date: '2026-11-04', items: [{ note: 'no place or name' }] }] },
    { title: 'T', days: [{ date: '2026-11-04', items: [{ name: 'x', time: '9am' }] }] },
  ]) {
    const { trip, errors } = parseTrip(bad);
    assert.equal(trip, null, JSON.stringify(bad));
    assert.ok(errors.length > 0, JSON.stringify(bad));
    assert.ok(errors.every(e => typeof e === 'string' && e.length > 0));
  }
});

test('resolveItem', () => {
  const r1 = resolveItem({ place: 'chihkan-tower' }, places);
  assert.equal(r1.place.id, 'chihkan-tower');
  assert.equal(r1.label, 'Chihkan Tower (Fort Provintia)');
  assert.equal(r1.missing, false);
  assert.deepEqual(resolveItem({ place: 'nope', name: 'Secret spot' }, places), { place: null, label: 'Secret spot', missing: true });
  assert.deepEqual(resolveItem({ place: 'nope' }, places), { place: null, label: 'nope', missing: true });
  assert.deepEqual(resolveItem({ name: 'Curry shop' }, places), { place: null, label: 'Curry shop', missing: false });
});

test('tripDayFor', () => {
  const { trip } = parseTrip(good);
  assert.equal(tripDayFor(trip, '2026-11-04').title, 'Old Taipei');
  assert.equal(tripDayFor(trip, '2026-12-01'), null);
});

test('tripUrlFrom only accepts https', () => {
  assert.equal(tripUrlFrom('?trip=' + encodeURIComponent('https://example.com/t.json')), 'https://example.com/t.json');
  assert.equal(tripUrlFrom('?x=1&trip=https%3A%2F%2Fa.b%2Fc.json'), 'https://a.b/c.json');
  assert.equal(tripUrlFrom(''), null);
  assert.equal(tripUrlFrom('?trip=http%3A%2F%2Fexample.com%2Ft.json'), null);
  assert.equal(tripUrlFrom('?trip=javascript%3Aalert(1)'), null);
  assert.equal(tripUrlFrom('?trip=not a url'), null);
});

test('loadTrip never throws', async () => {
  const ok = await loadTrip('https://x/t.json', async () => new Response(JSON.stringify(good)));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.trip.title, 'Markus in Taiwan');

  const notFound = await loadTrip('https://x/t.json', async () => new Response('nope', { status: 404 }));
  assert.equal(notFound.trip, null);
  assert.ok(notFound.errors.length > 0);

  const notJson = await loadTrip('https://x/t.json', async () => new Response('<html>'));
  assert.equal(notJson.trip, null);

  const offline = await loadTrip('https://x/t.json', async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(offline.trip, null);
  assert.ok(offline.errors.length > 0);
});

test('tripBlock formats one day', () => {
  const { trip } = parseTrip(good);
  assert.equal(tripBlock(trip, places, '2026-11-04'), [
    'My plan for 2026-11-04 (Old Taipei):',
    '- 09:30 Dadaocheng Dihua Street Historic District, tea first',
    '- Curry shop',
    '- Secret spot',
  ].join('\n'));
  assert.equal(tripBlock(trip, places, '2026-11-05'), 'My plan for 2026-11-05:');
  assert.equal(tripBlock(trip, places, '2026-12-01'), '');
});
