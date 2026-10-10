import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCenter, cities } from '../../app/js/data.js';
import { places } from '../fixtures.js';

test('cityCenter is the average of the city\'s places', () => {
  const tainan = places.filter(p => p.location.city_en === 'Tainan City').map(p => p.location.coordinates);
  const c = cityCenter(places, 'Tainan City');
  assert.ok(Math.abs(c.lat - tainan.reduce((s, x) => s + x.lat, 0) / tainan.length) < 1e-9);
  assert.equal(cityCenter(places, 'Atlantis'), null);
  for (const city of cities(places)) assert.ok(cityCenter(places, city), city);
});
