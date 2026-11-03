// Accessible names from lang.js (audit ui #11) and lang attributes on text in the other language (ui #12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import { emptyDraft } from '../../app/js/triplog.js';
import { renderLog } from '../../app/js/views/log.js';
import { renderPlace, driverCard } from '../../app/js/views/place.js';
import { renderExplore } from '../../app/js/views/explore.js';
import { renderAsk } from '../../app/js/views/ask.js';
import { phraseCard, phraseCardFull } from '../../app/js/views/reference.js';
import { foodDriverCard, foodSheet } from '../../app/js/views/food.js';
import { langTag } from '../../app/js/views/common.js';
import { foodFor } from '../../app/js/data.js';
import { guidebook, chihkan, sampleLog } from '../fixtures.js';

state.data = guidebook;
const s = (over = {}) => ({ ...state, data: guidebook, ...over });
const hello = guidebook.phrases.find(p => p.id === 'hello');
const tainan = foodFor(guidebook.food, 'Tainan City');
const oyster = tainan.picks.find(p => p.dish);
const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');

/** The opening tag of the element with this id in index.html. */
const tagOf = id => html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0];

// ---------- ui #11: accessible labels ----------

test('the new labels exist in both languages', () => {
  for (const key of ['switchLabel', 'starN', 'deleteEntry', 'bigCard']) {
    assert.notEqual(tr('en', key), key, `en ${key}`);
    assert.notEqual(tr('zh_TW', key), tr('en', key), `zh_TW ${key}`);
  }
  // The toggle's accessible name contains what it shows (voice control: "tap 中文").
  assert.ok(tr('en', 'switchLabel').includes(tr('en', 'switchTo')));
  assert.ok(tr('zh_TW', 'switchLabel').includes(tr('zh_TW', 'switchTo')));
});

test('stars: labelled in the UI language, the chosen rating pressed, inside a labelled group', () => {
  for (const L of ['en', 'zh_TW']) {
    const out = renderLog(s({ lang: L, draft: { ...emptyDraft(''), stars: 3 } }));
    assert.ok(out.includes(`<div class="stars" role="group" aria-label="${tr(L, 'rating')}">`), L);
    for (const n of [1, 2, 3, 4, 5]) {
      const b = out.match(new RegExp(`<button type="button" data-action="star" data-n="${n}"[^>]*>`))[0];
      assert.ok(b.includes(`aria-label="${tr(L, 'starN', { n })}"`), `${L} star ${n} label`);
      assert.ok(b.includes(`aria-pressed="${n === 3}"`), `${L} star ${n} pressed`);
    }
  }
  assert.doesNotMatch(renderLog(s({ lang: 'en', draft: emptyDraft('') })), /aria-pressed="true"/, 'no rating: none pressed');
});

test('delete buttons: named after the note, in the UI language, never "✕"', () => {
  const log = [{ id: 'x1', date: '2026-11-02', placeId: null, name: 'Tea "house" <b>', stars: 0, note: 'ok' }];
  const en = renderLog(s({ lang: 'en', log }));
  assert.ok(en.includes('aria-label="Delete note: Tea &quot;house&quot; &lt;b&gt;"'), 'escaped');
  assert.ok(renderLog(s({ lang: 'zh_TW', log })).includes('aria-label="刪除筆記：Tea &quot;house&quot; &lt;b&gt;"'));
  assert.doesNotMatch(renderLog(s({ lang: 'en', log: sampleLog })), /aria-label="✕"/);
});

test('index.html: dialogs and buttons have names; the toggle\'s name holds its text', () => {
  assert.match(tagOf('bigcard'), /role="dialog" aria-modal="true" aria-label="[^"]+"/);
  const toggle = html.match(/<button id="lang-toggle"[^>]*>([^<]*)<\/button>/);
  assert.match(toggle[0], new RegExp(`aria-label="${tr('en', 'switchLabel')}"`));
  assert.ok(tr('en', 'switchLabel').includes(toggle[1]));
});

// ---------- ui #12: lang attributes ----------

test('langTag: BCP 47 tags for lang=""', () => {
  assert.equal(langTag('zh_TW'), 'zh-TW');
  assert.equal(langTag('en'), 'en');
});

test('place page: the name in the other language carries its lang', () => {
  assert.ok(renderPlace(s({ lang: 'en' }), chihkan.id).includes(`<div class="zh" lang="zh-TW">${chihkan.name.zh_TW}</div>`));
  assert.ok(renderPlace(s({ lang: 'zh_TW' }), chihkan.id).includes(`<div class="zh" lang="en">${chihkan.name.en}</div>`));
});

test('place page: the English meaning of a useful phrase is marked English', () => {
  const out = renderPlace(s({ lang: 'zh_TW' }), chihkan.id);
  const rows = [...out.matchAll(/<button class="phrase-row" data-action="phrase-sheet"[\s\S]*?<\/button>/g)].map(m => m[0]);
  assert.ok(rows.length > 0);
  for (const r of rows) assert.match(r, /<span class="muted small" lang="en">/);
});

test('Explore cards: the other-language name carries its lang', () => {
  const en = renderExplore(s({ lang: 'en', pos: null, exploreCity: 'all' }));
  assert.ok(en.includes(`<div class="meta"><span lang="zh-TW">${chihkan.name.zh_TW}</span> · `));
  const zh = renderExplore(s({ lang: 'zh_TW', pos: null, exploreCity: 'all' }));
  assert.ok(zh.includes(`<div class="meta"><span lang="en">${chihkan.name.en}</span> · `));
});

test('big cards: the Chinese is zh-TW and the English gloss en, whatever the UI language', () => {
  const drv = driverCard(chihkan);
  assert.ok(drv.includes(`<div class="big" lang="zh-TW">${chihkan.name.zh_TW}</div>`));
  assert.equal((drv.match(/<div class="mid" lang="zh-TW">/g) || []).length, 2);
  assert.match(drv, /<div class="hint" lang="en">"Please take me here, thank you."<\/div>/);

  assert.equal(phraseCard(hello), '<div class="big" lang="zh-TW">你好</div><div class="hint" lang="en">Hello</div>');

  const food = foodDriverCard(tainan, oyster);
  assert.ok(food.includes(`<div class="big" lang="zh-TW">${oyster.name}</div>`));
  assert.ok(food.includes(`<div class="mid" lang="zh-TW">${tainan.city_zh}</div>`));
  assert.ok(food.includes('<div class="mid" lang="zh-TW">請帶我到這裡，謝謝。</div>'));
  assert.match(food, /<div class="hint" lang="en">/);
});

test('foodDriverCard escapes the pick and city names', () => {
  const out = foodDriverCard({ ...tainan, city_zh: '<i>台南</i>' }, { ...oyster, name: 'A&B <script>' });
  assert.ok(out.includes('A&amp;B &lt;script&gt;'));
  assert.ok(out.includes('&lt;i&gt;台南&lt;/i&gt;'));
});

test('phrase cards: the English meaning is marked English (the 中文 UI reads it with a Chinese voice otherwise)', () => {
  assert.match(phraseCardFull(hello, 'zh_TW'), /<span class="meta" lang="en">Hello<\/span>/);
});

test('food sheet (English UI): the Chinese dish name inside the English line is marked zh-TW', () => {
  const out = foodSheet(tainan, oyster, 'en');
  assert.ok(out.includes(`<div class="dish">${oyster.dish.en} (<span lang="zh-TW">${oyster.dish.zh_TW}</span>)</div>`));
  assert.ok(foodSheet(tainan, oyster, 'zh_TW').includes(`<div class="dish">${oyster.dish.zh_TW}</div>`));
});

test('Ask AI: the English area options are marked English', () => {
  const out = renderAsk(s({ lang: 'zh_TW', ask: { ...state.ask, mode: 'plan', area: 'city:Tainan City' } }));
  const opts = [...out.matchAll(/<option value="(city|district|place):[^"]*"[^>]*>/g)].map(m => m[0]);
  assert.ok(opts.length > 0);
  for (const o of opts) assert.match(o, / lang="en"/);
});
