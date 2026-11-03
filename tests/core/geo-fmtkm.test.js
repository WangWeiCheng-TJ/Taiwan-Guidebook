// fmtKm picks its unit after rounding (audit: "1000 m" and "10.0 km" just below the thresholds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtKm } from '../../app/js/geo.js';

test('fmtKm: a distance that rounds to 1000 m is shown in km', () => {
  assert.equal(fmtKm(0.9996), '1.0 km');
  assert.equal(fmtKm(0.9994), '999 m');
  assert.equal(fmtKm(1), '1.0 km');
});

test('fmtKm: a distance that rounds to 10.0 km drops the decimal', () => {
  assert.equal(fmtKm(9.97), '10 km');
  assert.equal(fmtKm(9.94), '9.9 km');
  assert.equal(fmtKm(10), '10 km');
});

test('fmtKm: ordinary values are unchanged', () => {
  assert.equal(fmtKm(0), '0 m');
  assert.equal(fmtKm(0.35), '350 m');
  assert.equal(fmtKm(2.34), '2.3 km');
  assert.equal(fmtKm(12.6), '13 km');
});
