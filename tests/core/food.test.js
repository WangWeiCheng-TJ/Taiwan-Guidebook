import test from 'node:test';
import assert from 'node:assert/strict';
import { foodFor, foodMapsLink } from '../../app/js/data.js';
import { foodBlock, buildAskPrompt } from '../../app/js/prompt.js';
import { guidebook, places, sampleLog } from '../fixtures.js';

const tainan = foodFor(guidebook.food, 'Tainan City');

test('foodFor and maps link', () => {
  assert.ok(tainan.picks.length > 10);
  assert.equal(foodFor(guidebook.food, 'Atlantis'), null);
  assert.equal(foodFor(undefined, 'Tainan City'), null);
  assert.match(foodMapsLink(tainan.picks[0], tainan), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.ok(decodeURIComponent(foodMapsLink(tainan.picks[0], tainan)).endsWith(`${tainan.picks[0].name} 臺南市`));
});

test('foodBlock groups by kind and carries hints', () => {
  const b = foodBlock(tainan);
  assert.match(b, /^Places to eat that a local friend recommends in Tainan City/);
  assert.ok(b.includes('\n- Tainan specialties: 柯家蚵嗲 (oyster fritters); 府城黃家蝦捲 (shrimp rolls)'));
  assert.ok(b.includes('- Taiwanese local food: 入街 (Closes early when sold out)'));
  assert.ok(b.indexOf('Tainan specialties') < b.indexOf('Taiwanese local food'));
  assert.ok(b.includes('- Local dishes I want to try, no shop chosen yet (recommend good places): 虱目魚 (milkfish); 魚皮湯 (fish skin soup)'));
  assert.ok(!b.includes('洁茂'));
  assert.ok(foodBlock({ city_en: 'X', city_zh: 'X', picks: [], to_try: [{ id: 'a', dish: { en: 'Milkfish', zh_TW: '虱目魚' } }] }).includes('虱目魚'));
  assert.equal(foodBlock(null), '');
  assert.equal(foodBlock({ city_en: 'X', city_zh: 'X', picks: [] }), '');
});

test('buildAskPrompt includes the picks only when given', () => {
  const ctx = { mode: 'plan', pos: null, radius: 3, area: 'city:Tainan City', customArea: '', day: 'tomorrow', question: null,
    includeLog: false, log: sampleLog, places, today: '2026-11-03' };
  assert.doesNotMatch(buildAskPrompt(ctx), /local friend/);
  const p = buildAskPrompt({ ...ctx, food: tainan });
  assert.ok(p.indexOf('Places from my guidebook') < p.indexOf('local friend'));
  assert.ok(p.indexOf('local friend') < p.indexOf('My question:'));
});
