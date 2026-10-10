import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLang, tr, trMsg, localized, localizedList, otherLang } from '../../app/js/lang.js';
import { buildAskPrompt, defaultQuestion } from '../../app/js/prompt.js';
import { places, chihkan, guidebook, sampleLog } from '../fixtures.js';

test('initialLang: saved choice, else browser language', () => {
  assert.equal(initialLang('zh_TW', 'en-GB'), 'zh_TW');
  assert.equal(initialLang('fr', 'zh-TW'), 'zh_TW');
  assert.equal(initialLang(null, 'zh-HK'), 'zh_TW');
  assert.equal(initialLang(null, 'de-DE'), 'en');
  assert.equal(initialLang(undefined), 'en');
});

test('tr fills placeholders and falls back to English, then the key', () => {
  assert.equal(tr('en', 'away', { d: '2 km' }), '2 km away');
  assert.equal(tr('zh_TW', 'away', { d: '2 km' }), '距離 2 km');
  assert.equal(tr('zh_TW', 'no-such-key'), 'no-such-key');
  assert.equal(otherLang('en'), 'zh_TW');
});

test('every English UI string has a Chinese translation', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../app/js/lang.js', import.meta.url), 'utf8');
  const keys = s => [...s.matchAll(/^\s+(?:'([^']+)'|(\w+)):/gm)].map(m => m[1] || m[2]);
  const [en, zh] = src.split('zh_TW: {');
  const missing = keys(en.split('en: {')[1]).filter(k => !keys(zh).includes(k));
  assert.deepEqual(missing, []);
});

test('trMsg translates known messages only', () => {
  assert.equal(trMsg('zh_TW', 'Add a rating or a note.'), '請給個評分或寫一句筆記。');
  assert.equal(trMsg('zh_TW', 'Day 1, stop 2: needs a place id or a name.'), 'Day 1, stop 2: needs a place id or a name.');
  assert.equal(trMsg('en', 'Add a rating or a note.'), 'Add a rating or a note.');
});

test('localized reads maps, paired fields and plain strings', () => {
  assert.equal(localized(chihkan, 'name', 'zh_TW'), '赤崁樓');
  assert.equal(localized(chihkan.location, 'city', 'zh_TW'), '臺南市');
  assert.equal(localized(chihkan.location, 'city', 'en'), 'Tainan City');
  const g = chihkan.foreign_visitor_guide;
  assert.equal(localized(g, 'best_time_to_visit', 'zh_TW'), g.best_time_to_visit); // English only: as is
  assert.deepEqual(localizedList(g, 'must_see_spots', 'zh_TW'), g.must_see_spots_zh);
  assert.equal(localized(chihkan.timeline[0], 'event', 'zh_TW'), chihkan.timeline[0].event_zh);
  assert.equal(localized(null, 'x', 'en'), '');
  const tip = guidebook.tips[0];
  assert.equal(localized(tip, 'title', 'zh_TW'), tip.title_zh);
  assert.equal(localized({ title_en: 'Only English' }, 'title', 'zh_TW'), 'Only English');
});

test('Chinese UI: Chinese default question and a reply-language line', () => {
  assert.match(defaultQuestion('plan', 'tomorrow', "Da'an", 'zh_TW'), /^請幫我規劃明天在 Da'an 的行程/);
  const ctx = { mode: 'plan', pos: null, radius: 3, area: '', customArea: "Da'an", day: 'tomorrow', question: null,
    includeLog: true, log: sampleLog, places, today: '2026-11-03', lang: 'zh_TW' };
  const p = buildAskPrompt(ctx);
  assert.match(p, /My question: 請幫我規劃/);
  assert.match(p, /Please reply in Traditional Chinese \(Taiwan\)\.$/);
  assert.doesNotMatch(buildAskPrompt({ ...ctx, lang: 'en' }), /Traditional Chinese/);
});
