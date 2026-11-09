// The filter chips say which one is chosen to screen readers too (aria-pressed), not only with class "on"
// (review: Explore's city chips and My trip's day chips gave no selected state).
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { renderExplore } from '../../app/js/views/explore.js';
import { renderTripSection } from '../../app/js/views/trip.js';
import { guidebook } from '../fixtures.js';

state.data = guidebook;
const s = (over = {}) => ({ ...state, data: guidebook, log: [], trip: null, pos: null, ...over });
/** Every chip button: its data-* key and whether it is pressed. */
const chips = (html, attr) => [...html.matchAll(new RegExp(`<button class="chip[^"]*" data-action="[^"]+" ${attr}="([^"]+)" aria-pressed="(true|false)">`, 'g'))]
  .map(m => [m[1], m[2] === 'true']);

test('Explore: the chosen city chip is pressed, the others are not; every chip says so', () => {
  for (const L of ['en', 'zh_TW']) {
    const html = renderExplore(s({ lang: L, exploreCity: 'Tainan City' }));
    const all = chips(html, 'data-city');
    assert.equal(all.length, (html.match(/data-action="city"/g) || []).length, 'no chip without aria-pressed');
    assert.deepEqual(all.filter(([, on]) => on).map(([c]) => c), ['Tainan City'], L);
    assert.ok(all.some(([c, on]) => c === 'all' && !on));
  }
  assert.deepEqual(chips(renderExplore(s({ lang: 'en', exploreCity: 'all' })), 'data-city').filter(([, on]) => on).map(([c]) => c), ['all']);
});

test('My trip: the shown day\'s chip is pressed', () => {
  const trip = { title: 'T', days: [{ date: '2026-11-04', items: [] }, { date: '2026-11-05', items: [] }] };
  const html = renderTripSection(s({ lang: 'en', trip, tripDate: '2026-11-05' }), '2026-11-03');
  assert.deepEqual(chips(html, 'data-date'), [['2026-11-04', false], ['2026-11-05', true]]);
});
