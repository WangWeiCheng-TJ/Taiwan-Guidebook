import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, clip, today, addDays, daysBetween, stars, titleCase } from '../../app/js/util.js';
import { km, fmtKm, distanceTo, sortByDistance, mapsLinks } from '../../app/js/geo.js';
import { places, chihkan, tainanStation } from '../fixtures.js';

test('esc escapes HTML and tolerates null', () => {
  assert.equal(esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(esc(null), '');
});

test('clip keeps short text and cuts long text with an ellipsis', () => {
  assert.equal(clip('short', 10), 'short');
  assert.equal(clip('abcdefghijk', 5), 'abcd…');
  assert.equal(clip(undefined, 5), '');
});

test('dates', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-11-02', '2026-11-05'), 3);
});

test('stars and titleCase', () => {
  assert.equal(stars(3), '★★★☆☆');
  assert.equal(stars(null), '');
  assert.equal(titleCase('daily-life'), 'Daily Life');
});

test('km is roughly right (Taipei 101 to Taipei Main Station ~ 4.6 km)', () => {
  const d = km({ lat: 25.0340, lng: 121.5645 }, { lat: 25.0478, lng: 121.5170 });
  assert.ok(d > 4.5 && d < 5.2, String(d));
});

test('fmtKm', () => {
  assert.equal(fmtKm(0.35), '350 m');
  assert.equal(fmtKm(2.34), '2.3 km');
  assert.equal(fmtKm(12.6), '13 km');
});

test('distanceTo is null without a position', () => {
  assert.equal(distanceTo(chihkan, null), null);
  assert.ok(distanceTo(chihkan, tainanStation) < 2);
});

test('sortByDistance puts Tainan places first from Tainan Station and does not mutate input', () => {
  const before = places.map(p => p.id);
  const sorted = sortByDistance(places, tainanStation);
  assert.equal(sorted[0].location.city_en, 'Tainan City');
  assert.deepEqual(places.map(p => p.id), before);
  assert.deepEqual(sortByDistance(places, null).map(p => p.id), before);
});

test('mapsLinks', () => {
  const l = mapsLinks(chihkan);
  assert.ok(l.google.includes('destination=22.9975,120.2026'));
  assert.ok(l.apple.startsWith('https://maps.apple.com/?daddr=22.9975,120.2026'));
});
