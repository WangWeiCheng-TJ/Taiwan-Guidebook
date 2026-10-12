// OpenStreetMap URLs for the place page's embedded map (online only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { osmEmbedUrl, osmLink } from '../../app/js/geo.js';
import { places } from '../fixtures.js';

test('osmEmbedUrl: a box around the point with a marker on it', () => {
  assert.equal(osmEmbedUrl(22.9975, 120.2026),
    'https://www.openstreetmap.org/export/embed.html?bbox=120.1966,22.9935,120.2086,23.0015&layer=mapnik&marker=22.9975,120.2026');
});

test('osmEmbedUrl: no floating-point noise in the box, and the box holds the point', () => {
  for (const p of places) {
    const { lat, lng } = p.location.coordinates;
    const url = new URL(osmEmbedUrl(lat, lng));
    const box = url.searchParams.get('bbox').split(',');
    assert.equal(box.length, 4, p.id);
    for (const v of box) assert.match(v, /^-?\d+(\.\d{1,6})?$/, `${p.id}: ${v}`);
    const [west, south, east, north] = box.map(Number);
    assert.ok(west < lng && lng < east && south < lat && lat < north, p.id);
    assert.ok(Math.abs(east - west - 0.012) < 1e-9 && Math.abs(north - south - 0.008) < 1e-9, p.id);
    assert.equal(url.searchParams.get('marker'), `${lat},${lng}`);
    assert.equal(url.searchParams.get('layer'), 'mapnik');
  }
});

test('osmLink: the point on openstreetmap.org with a marker', () => {
  assert.equal(osmLink(22.9975, 120.2026), 'https://www.openstreetmap.org/?mlat=22.9975&mlon=120.2026#map=17/22.9975/120.2026');
  assert.equal(osmLink(-33.5, -70.25), 'https://www.openstreetmap.org/?mlat=-33.5&mlon=-70.25#map=17/-33.5/-70.25');
});
