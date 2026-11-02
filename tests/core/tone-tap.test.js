// Tap-to-hear on a phrase card: what each character says must match the tone number shown under it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zhuyinBlock } from '../../app/js/views/reference.js';
import { guidebook } from '../fixtures.js';

/** [character, data-say] for every tappable character, in order. */
const taps = ph => [...zhuyinBlock(ph).matchAll(/data-say="([^"]*)"[^>]*>\s*<div class="han">([^<]*)<\/div>/g)]
  .map(m => [m[2], m[1]]);

test('a character keeps its own sound when the shown tone is its dictionary tone', () => {
  assert.deepEqual(taps({ zh_TW: '謝', zhuyin: 'ㄒㄧㄝˋ' }), [['謝', '謝']]);
  assert.deepEqual(taps({ zh_TW: '不好', zhuyin: 'ㄅㄨˋ ㄏㄠˇ' }), [['不', '不'], ['好', '好']]);
});

test('third-tone sandhi: the changed character is said with the next one', () => {
  assert.deepEqual(taps({ zh_TW: '你好', zhuyin: 'ㄋㄧˇ ㄏㄠˇ' }), [['你', '你好'], ['好', '好']]);
  assert.deepEqual(taps({ zh_TW: '我很好', zhuyin: 'ㄨㄛˇ ㄏㄣˇ ㄏㄠˇ' }), [['我', '我很'], ['很', '很好'], ['好', '好']]);
});

test('不 and 一 sandhi: said with the syllable that changes them', () => {
  assert.deepEqual(taps({ zh_TW: '不要', zhuyin: 'ㄅㄨˋ ㄧㄠˋ' }), [['不', '不要'], ['要', '要']]);
  assert.deepEqual(taps({ zh_TW: '一天', zhuyin: 'ㄧ ㄊㄧㄢ' }), [['一', '一天'], ['天', '天']]);
});

test('a light (neutral) syllable is said with the syllable before it', () => {
  assert.deepEqual(taps({ zh_TW: '謝謝', zhuyin: 'ㄒㄧㄝˋ ˙ㄒㄧㄝ' }), [['謝', '謝'], ['謝', '謝謝']]);
  // nothing before it: the character alone
  assert.deepEqual(taps({ zh_TW: '嗎', zhuyin: '˙ㄇㄚ' }), [['嗎', '嗎']]);
});

test('punctuation is never part of what is said', () => {
  assert.deepEqual(taps({ zh_TW: '好，好', zhuyin: 'ㄏㄠˇ ㄏㄠˇ' }), [['好', '好'], ['好', '好']]);
});

test('guidebook phrases from the finding: 你好 and 不要辣，謝謝', () => {
  const byId = Object.fromEntries(guidebook.phrases.map(p => [p.id, p]));
  assert.deepEqual(taps(byId.hello), [['你', '你好'], ['好', '好']]);
  assert.deepEqual(taps(byId['not-spicy']), [['不', '不要'], ['要', '要'], ['辣', '辣'], ['謝', '謝'], ['謝', '謝謝']]);
});
