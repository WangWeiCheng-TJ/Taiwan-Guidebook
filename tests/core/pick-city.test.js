// A picked city is an area, not a point (audit logic #5): its centre is the mean of its places, which for
// New Taipei lies between Tamsui and Ruifang, near neither. So no distances or radius from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCenter } from '../../app/js/data.js';
import { gpsDistance, distanceTo } from '../../app/js/geo.js';
import { buildAskPrompt } from '../../app/js/prompt.js';
import { state } from '../../app/js/state.js';
import { renderExplore } from '../../app/js/views/explore.js';
import { renderPlace } from '../../app/js/views/place.js';
import { renderAsk } from '../../app/js/views/ask.js';
import { guidebook, places, chihkan, tainanStation } from '../fixtures.js';

const pick = city => ({ ...cityCenter(places, city), source: 'pick', label: city, city });
const newTaipei = pick('New Taipei City');
const inCity = city => places.filter(p => p.location.city_en === city).map(p => p.id).sort();

test('the New Taipei centre is far from both of its places (why distances from it mislead)', () => {
  for (const p of places.filter(x => x.location.city_en === 'New Taipei City')) assert.ok(distanceTo(p, newTaipei) > 15, p.id);
});

test('gpsDistance: from GPS only', () => {
  assert.ok(gpsDistance(chihkan, tainanStation) < 2);
  assert.equal(gpsDistance(chihkan, pick('Tainan City')), null);
  assert.equal(gpsDistance(chihkan, null), null);
});

/** @param {object} over */
const nearPrompt = over => buildAskPrompt({
  mode: 'near', pos: newTaipei, radius: 3, area: '', customArea: '', day: 'today', question: null,
  includeLog: false, log: [], places, today: '2026-11-03', ...over,
});

test('buildAskPrompt near a picked city: that city\'s places, no distances, no radius', () => {
  const p = nearPrompt({});
  assert.match(p, /I'm somewhere in New Taipei City \(no GPS\)\./);
  assert.match(p, /Places from my guidebook in New Taipei City:\n1\. /);
  assert.doesNotMatch(p, /away|within \d+ km|nearest ones|middle of the city/);
  const listed = places.filter(x => p.includes(x.name.en)).map(x => x.id).sort();
  assert.deepEqual(listed, inCity('New Taipei City'));
  assert.ok(!p.includes('Dadaocheng'), 'a Taipei City place is not listed for New Taipei');
});

test('buildAskPrompt near a picked city: the radius changes nothing; ids still come with wantPlan', () => {
  assert.equal(nearPrompt({ radius: 25 }), nearPrompt({ radius: 1 }));
  assert.match(nearPrompt({ wantPlan: true }), /\[id: fort-san-domingo\]/);
});

test('buildAskPrompt near GPS still uses the radius and distances', () => {
  const p = nearPrompt({ pos: tainanStation });
  assert.match(p, /within 3 km/);
  assert.match(p, / away/);
});

/**
 * Render with the guidebook loaded and this position.
 * @param {(s: object) => string} view
 * @param {object} over
 */
function render(view, over) {
  const prev = state.data;
  state.data = guidebook;
  try {
    return view({ ...state, data: guidebook, log: [], trip: null, lang: 'en', ...over });
  } finally {
    state.data = prev;
  }
}
const distances = html => html.match(/<b>\d[\d.]* k?m<\/b>/g) || [];

test('Explore: a picked city shows "I\'m in" and no distances; GPS shows them', () => {
  const picked = render(s => renderExplore(s), { pos: newTaipei, exploreCity: 'New Taipei City' });
  assert.match(picked, /I'm in <b>New Taipei City<\/b>/);
  assert.deepEqual(distances(picked), []);
  const zh = render(s => renderExplore(s), { pos: newTaipei, exploreCity: 'New Taipei City', lang: 'zh_TW' });
  assert.match(zh, /我在 <b>新北市<\/b>/);
  const gps = render(s => renderExplore(s), { pos: tainanStation, exploreCity: 'Tainan City' });
  assert.match(gps, /Distances from <b>your location<\/b>/);
  assert.equal(distances(gps).length, inCity('Tainan City').length);
});

test('Explore under "All": a picked city\'s own places come first, the rest by distance from it', () => {
  // From the New Taipei centre, Dadaocheng (Taipei City) is nearer than either New Taipei place.
  const sorted = [...places].sort((a, b) => distanceTo(a, newTaipei) - distanceTo(b, newTaipei));
  assert.equal(sorted[0].id, 'dadaocheng-dihua-street');
  const html = render(s => renderExplore(s), { pos: newTaipei, exploreCity: 'all' });
  const order = [...html.matchAll(/href="#\/place\/([^"]+)"/g)].map(m => m[1]);
  assert.equal(order.length, places.length);
  assert.deepEqual(order.slice(0, 2).sort(), inCity('New Taipei City'));
  assert.equal(order[2], 'dadaocheng-dihua-street');
  assert.deepEqual(distances(html), []);
});

test('Place page: no "away" from a picked city', () => {
  const picked = render(s => renderPlace(s, 'jiufen-gold-mountain'), { pos: newTaipei });
  assert.doesNotMatch(picked, / away</);
  const gps = render(s => renderPlace(s, 'chihkan-tower'), { pos: tainanStation });
  assert.match(gps, / away</);
});

test('Ask AI near mode: the radius select only with GPS', () => {
  const ask = { ...state.ask, mode: 'near' };
  assert.doesNotMatch(render(s => renderAsk(s), { ask, pos: newTaipei }), /data-change="radius"/);
  assert.match(render(s => renderAsk(s), { ask, pos: tainanStation }), /data-change="radius"/);
  assert.match(render(s => renderAsk(s), { ask, pos: null }), /data-change="radius"/);
});
