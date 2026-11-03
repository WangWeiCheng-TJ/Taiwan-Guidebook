// areaPlaces with a typed area (audit logic #2 and #8): Chinese names, and "New Taipei" before "Taipei".
import test from 'node:test';
import assert from 'node:assert/strict';
import { areaPlaces, buildAskPrompt } from '../../app/js/prompt.js';
import { places } from '../fixtures.js';

const ids = text => areaPlaces(places, 'custom', text).map(p => p.id).sort();
const inCity = city => places.filter(p => p.location.city_en === city).map(p => p.id).sort();

test('areaPlaces: a Chinese city name matches, written with 台 or 臺, with or without 市', () => {
  const tainan = inCity('Tainan City');
  assert.ok(tainan.length > 0);
  for (const text of ['台南', '臺南', '臺南市', '台南市中西區', '明天去台南玩']) assert.deepEqual(ids(text), tainan, text);
});

test('areaPlaces: 台北 is Taipei City, 新北 is New Taipei City', () => {
  assert.deepEqual(ids('台北市大安區'), inCity('Taipei City'));
  assert.deepEqual(ids('新北市'), inCity('New Taipei City'));
  assert.deepEqual(ids('新北市淡水區'), inCity('New Taipei City'));
});

test('areaPlaces: a Chinese district name matches only its own places', () => {
  assert.deepEqual(ids('淡水'), ['fort-san-domingo']);
  assert.deepEqual(ids('瑞芳'), ['jiufen-gold-mountain']);
  assert.deepEqual(ids('鹿港鎮'), ['lukang-longshan-temple']);
  assert.deepEqual(ids('大安區'), []);
});

test('areaPlaces: a later standalone "Taipei" counts even after "New Taipei"', () => {
  const both = [...inCity('New Taipei City'), ...inCity('Taipei City')].sort();
  assert.deepEqual(ids('Tamsui, New Taipei, then dinner in Taipei'), both);
  assert.deepEqual(ids('Taipei, then Tamsui in New Taipei'), both);
  assert.deepEqual(ids('New Taipei'), inCity('New Taipei City'));
  assert.deepEqual(ids('new taipei and new taipei again'), inCity('New Taipei City'));
});

test('buildAskPrompt: a Chinese custom area brings in the guidebook places', () => {
  const p = buildAskPrompt({
    mode: 'plan', pos: null, radius: 3, area: '', customArea: '台南', day: 'tomorrow', question: null,
    includeLog: false, log: [], places, today: '2026-11-03', lang: 'zh_TW',
  });
  assert.match(p, /Places from my guidebook in or around this area:\n1\. /);
  assert.match(p, /Chihkan Tower/);
});
