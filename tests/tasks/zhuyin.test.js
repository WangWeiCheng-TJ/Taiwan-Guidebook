// Contract for app/js/zhuyin.js. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZHUYIN_ROMAN, parseSyllable, alignZhuyin } from '../../app/js/zhuyin.js';
import { guidebook } from '../fixtures.js';

const p = (symbol, roman) => ({ symbol, roman });

test('ZHUYIN_ROMAN has the 37 symbols', () => {
  assert.equal(Object.keys(ZHUYIN_ROMAN).length, 37);
  assert.equal(ZHUYIN_ROMAN['ㄓ'], 'zh');
  assert.equal(ZHUYIN_ROMAN['ㄩ'], 'ü');
  assert.equal(ZHUYIN_ROMAN['ㄝ'], 'ê');
  assert.equal(ZHUYIN_ROMAN['ㄥ'], 'eng');
  assert.equal(ZHUYIN_ROMAN['ㄦ'], 'er');
  assert.ok(Object.isFrozen(ZHUYIN_ROMAN));
});

test('tones', () => {
  assert.deepEqual(parseSyllable('ㄋㄧˇ'), { parts: [p('ㄋ', 'n'), p('ㄧ', 'i')], tone: 3 });
  assert.deepEqual(parseSyllable('ㄊㄤˊ'), { parts: [p('ㄊ', 't'), p('ㄤ', 'ang')], tone: 2 });
  assert.deepEqual(parseSyllable('ㄌㄚˋ'), { parts: [p('ㄌ', 'l'), p('ㄚ', 'a')], tone: 4 });
  assert.deepEqual(parseSyllable('ㄕㄨㄛ'), { parts: [p('ㄕ', 'sh'), p('ㄨ', 'u'), p('ㄛ', 'o')], tone: 1 });
  assert.deepEqual(parseSyllable('ㄅㄤˉ'), { parts: [p('ㄅ', 'b'), p('ㄤ', 'ang')], tone: 1 });
});

test('neutral tone mark before or after', () => {
  const want = { parts: [p('ㄒ', 'x'), p('ㄧ', 'i'), p('ㄝ', 'ê')], tone: 5 };
  assert.deepEqual(parseSyllable('˙ㄒㄧㄝ'), want);
  assert.deepEqual(parseSyllable('ㄒㄧㄝ˙'), want);
  assert.deepEqual(parseSyllable('  ˙ㄒㄧㄝ '), want);
});

test('standalone sibilants carry their vowel', () => {
  assert.deepEqual(parseSyllable('ㄔ'), { parts: [p('ㄔ', 'chi')], tone: 1 });
  assert.deepEqual(parseSyllable('ㄓˇ'), { parts: [p('ㄓ', 'zhi')], tone: 3 });
  assert.deepEqual(parseSyllable('˙ㄙ'), { parts: [p('ㄙ', 'si')], tone: 5 });
  assert.deepEqual(parseSyllable('˙ㄗ'), { parts: [p('ㄗ', 'zi')], tone: 5 });
  assert.deepEqual(parseSyllable('ㄓㄜˋ'), { parts: [p('ㄓ', 'zh'), p('ㄜ', 'e')], tone: 4 });
  assert.deepEqual(parseSyllable('ㄦˊ'), { parts: [p('ㄦ', 'er')], tone: 2 });
  assert.deepEqual(parseSyllable('ㄩㄥˋ'), { parts: [p('ㄩ', 'ü'), p('ㄥ', 'eng')], tone: 4 });
});

test('invalid syllables', () => {
  for (const bad of ['', '   ', 'ˇ', '˙', 'nǐ', 'ㄋㄧˇˇ', 'ㄋㄧˇˋ', 'ㄋXㄧ']) {
    assert.equal(parseSyllable(bad), null, JSON.stringify(bad));
  }
});

test('alignZhuyin skips punctuation and tolerates extra spaces', () => {
  const a = alignZhuyin('不要辣，謝謝', '  ㄅㄨˊ   ㄧㄠˋ ㄌㄚˋ ㄒㄧㄝˋ ˙ㄒㄧㄝ ');
  assert.equal(a.length, 6);
  assert.deepEqual(a.map(x => x.char), ['不', '要', '辣', '，', '謝', '謝']);
  assert.equal(a[3].syllable, null);
  assert.equal(a[0].syllable.tone, 2);
  assert.equal(a[5].syllable.tone, 5);
});

test('alignZhuyin returns null on mismatch or bad syllables', () => {
  assert.equal(alignZhuyin('你好', 'ㄋㄧˇ'), null);
  assert.equal(alignZhuyin('你好', 'ㄋㄧˇ ㄏㄠˇ ㄇㄚ'), null);
  assert.equal(alignZhuyin('你好', 'ㄋㄧˇ hao'), null);
});

test('every phrase in the guidebook aligns', () => {
  for (const ph of guidebook.phrases) {
    assert.ok(alignZhuyin(ph.zh_TW, ph.zhuyin), ph.id);
  }
});
