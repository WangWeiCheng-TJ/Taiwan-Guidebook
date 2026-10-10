import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areaOptions, areaLabel, areaPlaces, nearPlaces, defaultQuestion, placeBrief, logBlock,
  buildAskPrompt, buildPlacePrompt,
} from '../../app/js/prompt.js';
import { places, chihkan, tainanStation, sampleLog } from '../fixtures.js';

/** @returns {import('../../app/js/types.js').AskContext} */
function ctx(over = {}) {
  return {
    mode: 'plan', pos: null, radius: 3, area: '', customArea: '', day: 'tomorrow', question: null,
    includeLog: true, log: sampleLog, places, today: '2026-11-03', ...over,
  };
}

test('areaOptions lists each city followed by its districts', () => {
  const opts = areaOptions(places);
  const i = opts.findIndex(o => o.value === 'city:Tainan City');
  assert.ok(i >= 0);
  assert.ok(opts[i + 1].value.startsWith('district:Tainan City|'));
});

test('areaLabel', () => {
  assert.equal(areaLabel('city:Tainan City', ''), 'Tainan City');
  assert.equal(areaLabel('district:Tainan City|West Central District', ''), 'West Central District, Tainan City');
  assert.equal(areaLabel('custom', "  Da'an, Taipei "), "Da'an, Taipei");
});

test('areaPlaces: custom "Taipei" matches Taipei City but not New Taipei City', () => {
  const ids = areaPlaces(places, 'custom', "Da'an District, Taipei").map(p => p.id);
  assert.ok(ids.includes('dadaocheng-dihua-street'));
  assert.ok(!ids.includes('fort-san-domingo')); // New Taipei City
  assert.deepEqual(areaPlaces(places, 'custom', '   '), []);
  const nt = areaPlaces(places, 'custom', 'New Taipei').map(p => p.id);
  assert.ok(nt.includes('fort-san-domingo'));
});

test('nearPlaces: within radius, else 3 nearest fallback', () => {
  const near = nearPlaces(places, tainanStation, 3);
  assert.equal(near.within, true);
  assert.ok(near.list.every(p => p.location.city_en === 'Tainan City'));
  const far = nearPlaces(places, { lat: 24.0, lng: 121.6, source: 'gps', label: '' }, 1);
  assert.equal(far.within, false);
  assert.equal(far.list.length, 3);
  assert.deepEqual(nearPlaces(places, null, 3), { list: [], within: true });
});

test('defaultQuestion', () => {
  assert.match(defaultQuestion('near', 'tomorrow', ''), /next few hours/);
  assert.match(defaultQuestion('plan', 'tomorrow', "Da'an"), /plan for tomorrow in Da'an/);
});

test('placeBrief numbers from 1 and shows distance only when given', () => {
  assert.match(placeBrief(chihkan, 0, null), /^1\. Chihkan Tower/);
  assert.doesNotMatch(placeBrief(chihkan, 0, null), /away/);
  assert.match(placeBrief(chihkan, 1, 0.8), /^2\. .*800 m away/);
});

test('logBlock is chronological and empty for an empty log', () => {
  const b = logBlock(sampleLog, places);
  assert.equal(logBlock([], places), '');
  assert.ok(b.indexOf('2026-11-02') < b.indexOf('2026-11-03'));
  assert.match(b, /- 2026-11-03, Curry shop: too salty/);
  assert.match(b, /Lukang Longshan Temple: 2\/5, boring for me/);
});

test('buildAskPrompt plan mode: area, date, notes, places, question', () => {
  const p = buildAskPrompt(ctx({ customArea: "Da'an District, Taipei" }));
  assert.match(p, /day 2 of my trip/);
  assert.match(p, /explore Da'an District, Taipei tomorrow \(2026-11-04\)/);
  assert.match(p, /too salty/);
  assert.match(p, /Dadaocheng/);
  assert.match(p, /My question: Suggest a plan for tomorrow in Da'an District, Taipei/);
});

test('buildAskPrompt respects includeLog=false and an edited question', () => {
  const p = buildAskPrompt(ctx({ includeLog: false, question: 'Where is good coffee?' }));
  assert.doesNotMatch(p, /too salty/);
  assert.match(p, /My question: Where is good coffee\?$/);
});

test('buildAskPrompt near mode with GPS rounds coordinates and lists distances', () => {
  const p = buildAskPrompt(ctx({ mode: 'near', pos: tainanStation }));
  assert.match(p, /GPS 22\.997, 120\.213/);
  assert.match(p, /within 3 km/);
  assert.match(p, /km away|m away/);
});

test('buildPlacePrompt includes history, my notes, and ends with the question stub', () => {
  const p = buildPlacePrompt(chihkan, [{ id: 'z', date: '2026-11-03', placeId: chihkan.id, name: '', stars: 4, note: 'great at night' }]);
  assert.match(p, /History: /);
  assert.match(p, /My own notes: 4\/5, great at night/);
  assert.ok(p.endsWith('My question: '));
});
