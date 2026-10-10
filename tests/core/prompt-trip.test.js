// T3: the loaded plan and the paste-back request inside the Ask AI prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAskPrompt, placeBrief } from '../../app/js/prompt.js';
import { parseTrip, defaultTripDate } from '../../app/js/trip.js';
import { places, chihkan, sampleLog } from '../fixtures.js';

const { trip } = parseTrip({
  title: 'Test trip',
  days: [
    { date: '2026-11-03', items: [{ place: 'chihkan-tower', time: '09:00' }] },
    { date: '2026-11-04', title: 'Old Taipei', items: [{ name: 'Curry shop' }] },
  ],
});

function ctx(over = {}) {
  return {
    mode: 'plan', pos: null, radius: 3, area: 'city:Tainan City', customArea: '', day: 'tomorrow', question: null,
    includeLog: true, log: sampleLog, places, today: '2026-11-03', ...over,
  };
}

test('without trip/wantPlan the prompt is unchanged (fields optional)', () => {
  const base = buildAskPrompt(ctx());
  assert.equal(buildAskPrompt(ctx({ trip: null, wantPlan: false })), base);
  assert.doesNotMatch(base, /\[id: /);
  assert.doesNotMatch(base, /```json/);
});

test('plan mode tomorrow includes tomorrow\'s plan, near mode includes today\'s', () => {
  assert.match(buildAskPrompt(ctx({ trip })), /My plan for 2026-11-04 \(Old Taipei\):\n- Curry shop/);
  const near = buildAskPrompt(ctx({ trip, mode: 'near' }));
  assert.match(near, /My plan for 2026-11-03:\n- 09:00 Chihkan Tower/);
  assert.doesNotMatch(buildAskPrompt(ctx({ trip, day: 'today', today: '2026-12-01' })), /My plan for/);
});

test('plan paragraph comes after the notes and before the places', () => {
  const p = buildAskPrompt(ctx({ trip }));
  assert.ok(p.indexOf('too salty') < p.indexOf('My plan for'));
  assert.ok(p.indexOf('My plan for') < p.indexOf('Places from my guidebook'));
});

test('wantPlan adds place ids and ends with the JSON request', () => {
  const p = buildAskPrompt(ctx({ wantPlan: true }));
  assert.match(p, /Chihkan Tower .*\[id: chihkan-tower\]/);
  assert.match(p, /```json[\s\S]*```$/);
  assert.ok(p.indexOf('My question:') < p.indexOf('```json'));
});

test('placeBrief withId', () => {
  assert.match(placeBrief(chihkan, 0, null, true).split('\n')[0], /\[id: chihkan-tower\]$/);
  assert.doesNotMatch(placeBrief(chihkan, 0, null), /\[id:/);
});

test('defaultTripDate: today, else next upcoming, else last', () => {
  assert.equal(defaultTripDate(trip, '2026-11-03'), '2026-11-03');
  assert.equal(defaultTripDate(trip, '2026-11-01'), '2026-11-03');
  assert.equal(defaultTripDate(trip, '2026-12-25'), '2026-11-04');
});

test('parseTrip errors name the day and stop', () => {
  const { errors } = parseTrip({ title: 'x', days: [{ date: '2026-11-04', items: [{ name: 'a' }, { note: 'n' }] }, { date: 'nov 5', items: [] }] });
  assert.deepEqual(errors, ['Day 1, stop 2: needs a place id or a name.', 'Day 2: date must be YYYY-MM-DD, like 2026-11-04.']);
});
