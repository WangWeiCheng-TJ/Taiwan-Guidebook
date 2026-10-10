// Contract for TASK T4, JS side (app/js/i18n.js). Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { t, tList, languagesOf } from '../../app/js/i18n.js';

test('t picks lang, then fallback, then first non-empty', () => {
  const v = { en: 'Temple', zh_TW: '廟', de: 'Tempel' };
  assert.equal(t(v, 'de'), 'Tempel');
  assert.equal(t(v, 'fr'), 'Temple');
  assert.equal(t({ zh_TW: '廟' }, 'fr'), '廟');
  assert.equal(t({ en: '', zh_TW: '廟' }, 'en'), '廟');
  assert.equal(t('plain string', 'de'), 'plain string');
  assert.equal(t(null), '');
  assert.equal(t(undefined, 'de'), '');
});

test('tList always returns an array', () => {
  assert.deepEqual(tList({ en: ['a', 'b'], zh_TW: ['甲'] }, 'zh_TW'), ['甲']);
  assert.deepEqual(tList({ en: ['a'] }, 'de'), ['a']);
  assert.deepEqual(tList(['x']), ['x']);
  assert.deepEqual(tList(null), []);
});

test('languagesOf orders en, zh_TW, then the rest alphabetically', () => {
  assert.deepEqual(languagesOf({ fr: 'x', zh_TW: 'x', de: 'x', en: 'x' }), ['en', 'zh_TW', 'de', 'fr']);
  assert.deepEqual(languagesOf(null), []);
});
