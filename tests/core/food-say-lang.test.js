// The 🔊 button in a food pick's or dish's sheet is named in the UI language, so it must not sit inside the
// Chinese name's lang="zh-TW" (review: in the English UI "Listen" was read with the Chinese voice).
import test from 'node:test';
import assert from 'node:assert/strict';
import { foodSheet, dishSheet } from '../../app/js/views/food.js';
import { tr } from '../../app/js/lang.js';
import { foodFor } from '../../app/js/data.js';
import { guidebook } from '../fixtures.js';

globalThis.speechSynthesis ??= { getVoices: () => [], cancel() {}, speak() {} }; // sayButton needs a device voice
const tainan = foodFor(guidebook.food, 'Tainan City');
const pick = tainan.picks[0];
const dish = (tainan.to_try || [])[0];

test('the name line: only the Chinese name is tagged zh-TW; the button keeps the UI language', () => {
  const cases = [['foodSheet', L => foodSheet(tainan, pick, L), pick.name]];
  if (dish) cases.push(['dishSheet', L => dishSheet(tainan, dish, L), dish.dish.zh_TW]);
  for (const [name, render, zh] of cases) {
    for (const L of ['en', 'zh_TW']) {
      const line = /<div class="big-name">(.*?)<\/div>/s.exec(render(L))?.[1];
      assert.ok(line, `${name} ${L}: the name line`);
      assert.ok(line.startsWith(`<span lang="zh-TW">${zh}</span> `), `${name} ${L}`);
      assert.ok(line.includes(`aria-label="${tr(L, 'listen')}"`), `${name} ${L}: the button`);
      assert.doesNotMatch(line.slice(line.indexOf('</span>')), /lang="zh-TW"/, `${name} ${L}`);
    }
  }
});
