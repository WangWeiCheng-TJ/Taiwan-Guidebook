// Contract for spokenTones in app/js/zhuyin.js. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignZhuyin, spokenTones } from '../../app/js/zhuyin.js';
import { guidebook } from '../fixtures.js';

const tones = (zh, zy) => spokenTones(alignZhuyin(zh, zy));

test('third-tone sandhi', () => {
  assert.deepEqual(tones('你好', 'ㄋㄧˇ ㄏㄠˇ'), [2, 3]);
  assert.deepEqual(tones('我很好', 'ㄨㄛˇ ㄏㄣˇ ㄏㄠˇ'), [2, 2, 3]);
  assert.deepEqual(tones('可以刷卡嗎', 'ㄎㄜˇ ㄧˇ ㄕㄨㄚ ㄎㄚˇ ˙ㄇㄚ'), [2, 3, 1, 3, 5]);
  assert.deepEqual(tones('請問廁所在哪裡', 'ㄑㄧㄥˇ ㄨㄣˋ ㄘㄜˋ ㄙㄨㄛˇ ㄗㄞˋ ㄋㄚˇ ㄌㄧˇ'), [3, 4, 4, 3, 4, 2, 3]);
  assert.deepEqual(tones('我們', 'ㄨㄛˇ ˙ㄇㄣ'), [3, 5]);
});

test('不 and 一', () => {
  assert.deepEqual(tones('不要', 'ㄅㄨˋ ㄧㄠˋ'), [2, 4]);
  assert.deepEqual(tones('不好', 'ㄅㄨˋ ㄏㄠˇ'), [4, 3]);
  assert.deepEqual(tones('不需', 'ㄅㄨˋ ㄒㄩ'), [4, 1]);
  assert.deepEqual(tones('一個', 'ㄧ ㄍㄜˋ'), [2, 4]);
  assert.deepEqual(tones('一天', 'ㄧ ㄊㄧㄢ'), [4, 1]);
  assert.deepEqual(tones('一起', 'ㄧ ㄑㄧˇ'), [4, 3]);
  assert.deepEqual(tones('統一', 'ㄊㄨㄥˇ ㄧ'), [3, 1]);
  assert.deepEqual(tones('一點點', 'ㄧ ㄉㄧㄢˇ ㄉㄧㄢˇ'), [4, 2, 3]);
});

test('punctuation breaks runs and is not a next syllable', () => {
  assert.deepEqual(tones('好，好', 'ㄏㄠˇ ㄏㄠˇ'), [3, null, 3]);
  assert.deepEqual(tones('不，要', 'ㄅㄨˋ ㄧㄠˋ'), [4, null, 4]);
});

test('does not mutate the aligned input', () => {
  const a = alignZhuyin('你好', 'ㄋㄧˇ ㄏㄠˇ');
  const before = JSON.stringify(a);
  spokenTones(a);
  assert.equal(JSON.stringify(a), before);
});

test('guidebook phrases', () => {
  const byId = Object.fromEntries(guidebook.phrases.map(p => [p.id, p]));
  const of = id => tones(byId[id].zh_TW, byId[id].zhuyin);
  assert.deepEqual(of('hello'), [2, 3]);
  assert.deepEqual(of('no-chinese'), [3, 2, 4, 1, 1, 2]);
  assert.deepEqual(of('not-spicy'), [2, 4, 4, null, 4, 5]);
  assert.deepEqual(of('card-ok'), [2, 3, 1, 3, 5, null]); // trailing ？
});
