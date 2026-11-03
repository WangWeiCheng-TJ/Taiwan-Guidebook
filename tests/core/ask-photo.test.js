// "Ask AI about a photo" in the views: the Ask AI tab's photo mode (ask.js) and "Ask AI about the menu" on the
// food sheets (food.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import { buildAskPrompt, buildPhotoPrompt, PHOTO_KINDS } from '../../app/js/prompt.js';
import { esc } from '../../app/js/util.js';
import { foodFor } from '../../app/js/data.js';
import { renderAsk, askContext, photoContext, currentPrompt } from '../../app/js/views/ask.js';
import { foodSheet, dishSheet, menuShop, menuPromptSheet } from '../../app/js/views/food.js';
import { aiLinks } from '../../app/js/views/common.js';
import { guidebook } from '../fixtures.js';

state.data = guidebook;
const s = (ask = {}, over = {}) => ({ ...state, data: guidebook, lang: 'en', log: [], trip: null, pos: null, ask: { ...state.ask, ...ask }, ...over });
const tainan = foodFor(guidebook.food, 'Tainan City');
const hotpot = tainan.picks.find(p => p.id === 'xiao-hao-zhou-satay-hotpot');
const rujie = tainan.picks.find(p => p.id === 'ru-jie');
const milkfish = tainan.to_try.find(d => d.dish.zh_TW === '虱目魚');

// ---------- Ask AI tab ----------

test('the mode switch has a third button, "About a photo"; the current mode is pressed', () => {
  for (const L of ['en', 'zh_TW']) {
    const out = renderAsk(s({ mode: 'photo' }, { lang: L }));
    assert.ok(out.includes(`<button class="on" data-action="mode" data-mode="photo" aria-pressed="true">${tr(L, 'photoMode')}</button>`), L);
    assert.ok(out.includes(`data-mode="near" aria-pressed="false">${tr(L, 'nearMe')}</button>`), L);
    assert.ok(out.includes(`data-mode="plan" aria-pressed="false">${tr(L, 'planDay')}</button>`), L);
  }
  assert.match(renderAsk(s({ mode: 'near' })), /data-mode="near" aria-pressed="true"/);
});

test('photo mode: a labelled group of the five presets as radio buttons, the chosen one checked', () => {
  for (const L of ['en', 'zh_TW']) {
    const out = renderAsk(s({ mode: 'photo', photo: 'board' }, { lang: L }));
    assert.ok(out.includes(`<fieldset class="kinds">\n      <legend>${tr(L, 'photoWhat')}</legend>`), L);
    const radios = [...out.matchAll(/<input type="radio" name="photo-kind" value="(\w+)" data-change="photo-kind" ?(checked)?>/g)];
    assert.deepEqual(radios.map(m => m[1]), [...PHOTO_KINDS], L);
    assert.deepEqual(radios.filter(m => m[2]).map(m => m[1]), ['board'], L);
    for (const k of PHOTO_KINDS) {
      assert.ok(out.includes(`${tr(L, `photo.${k}`)}<span class="muted small">${tr(L, `photo.${k}.hint`)}</span>`), `${L} ${k}`);
    }
    assert.ok(out.includes(`<p class="muted small">${tr(L, 'photoIntro')}</p>`), L);
  }
});

test('photo mode: the note box (escaped) instead of the question box and the toggles; party, copy and links stay', () => {
  const out = renderAsk(s({ mode: 'photo', photoNote: 'No <pork> & "beef"' }));
  assert.ok(out.includes('<textarea data-input="photo-note" rows="2" placeholder="e.g. I don&#39;t eat pork. Going to Tamsui.">No &lt;pork&gt; &amp; &quot;beef&quot;</textarea>'));
  assert.ok(out.includes(tr('en', 'photoNote')));
  for (const gone of ['data-input="question"', 'data-change="include-log"', 'data-change="want-plan"', 'data-change="radius"']) {
    assert.ok(!out.includes(gone), gone);
  }
  assert.ok(out.includes('data-action="party-inc"'));
  assert.ok(out.includes('data-action="copy-prompt"'));
  assert.ok(out.includes(aiLinks('en')));
  assert.ok(out.includes('data-action="locate"'), 'the location panel: it tells the AI where the photo is from');
});

test('photo mode: the preview is the photo prompt for the chosen preset, escaped', () => {
  const st = s({ mode: 'photo', photo: 'sign', photoNote: 'a < b' });
  const out = renderAsk(st);
  const pre = out.match(/<pre class="prompt" id="prompt-preview">([\s\S]*?)<\/pre>/)[1];
  assert.match(pre, /The attached photo shows a sign or notice\. Please:/);
  assert.match(pre, /Also keep in mind: a &lt; b/);
  const noClock = t => t.replace(/(Today is \d{4}-\d\d-\d\d), \d\d:\d\d\./, '$1.'); // a minute may tick in between
  assert.equal(noClock(pre), noClock(esc(buildPhotoPrompt(photoContext(st), 'sign', 'en'))), 'the whole prompt');
});

test('near and plan modes are unchanged: no presets, the question box, the Ask AI prompt', () => {
  for (const mode of ['near', 'plan']) {
    const out = renderAsk(s({ mode }));
    assert.ok(!out.includes('photo-kind'), mode);
    assert.ok(!out.includes('photo-note'), mode);
    assert.ok(out.includes('data-input="question"'), mode);
    assert.ok(out.includes(`<p class="muted small">${tr('en', 'askIntro')}</p>`), mode);
  }
});

test('currentPrompt: the photo prompt in photo mode, the Ask AI prompt otherwise', () => {
  const photo = s({ mode: 'photo', photo: 'label' }, { lang: 'zh_TW' });
  assert.match(currentPrompt(photo), /^（送出前/);
  assert.match(currentPrompt(photo), /The attached photo shows a food label or ingredient list\./);
  const near = s({ mode: 'near' });
  assert.equal(currentPrompt(near), buildAskPrompt(askContext(near)));
});

test('photoContext: the party only once set, the note, today and the time; a shop leaves the note out', () => {
  const c = photoContext(s({ photoNote: 'Vegetarian' }, { party: 4, partySet: false }));
  assert.equal(c.party, null);
  assert.equal(c.note, 'Vegetarian');
  assert.equal(c.shop, null);
  assert.match(c.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(c.time, /^\d\d:\d\d$/);
  assert.equal(c.places, guidebook.places);
  assert.equal(photoContext(s({}, { party: 4, partySet: true })).party, 4);

  const shop = menuShop(guidebook.food, 'Tainan City', hotpot.id, 'pick');
  const withShop = photoContext(s({ photoNote: 'Vegetarian' }), shop);
  assert.equal(withShop.shop, shop);
  assert.equal(withShop.note, '', 'the note was written for another photo');
});

// ---------- food sheets ----------

test('food pick sheet: an "Ask AI about the menu" button naming the pick', () => {
  for (const L of ['en', 'zh_TW']) {
    const out = foodSheet(tainan, hotpot, L);
    assert.ok(out.includes(`<button class="btn" data-action="ask-menu" data-city="Tainan City" data-id="${hotpot.id}" data-kind="pick"><span aria-hidden="true">✦</span> ${tr(L, 'askMenu')}</button>`), L);
  }
});

test('dish sheet: the same button for the dish', () => {
  const out = dishSheet(tainan, milkfish, 'zh_TW');
  assert.ok(out.includes(`data-action="ask-menu" data-city="Tainan City" data-id="${milkfish.id}" data-kind="dish">`));
  assert.ok(out.includes(tr('zh_TW', 'askMenu')));
});

test('the button escapes the city and id', () => {
  const out = foodSheet({ ...tainan, city_en: 'A"B<' }, { ...hotpot, id: 'x"y' }, 'en');
  assert.ok(out.includes('data-action="ask-menu" data-city="A&quot;B&lt;" data-id="x&quot;y" data-kind="pick"'));
});

test('menuShop: a pick with its name, dish and hint; a pick without them; a dish; nothing for unknown ones', () => {
  assert.deepEqual(menuShop(guidebook.food, 'Tainan City', hotpot.id, 'pick'),
    { city_en: 'Tainan City', city_zh: tainan.city_zh, name: hotpot.name, dish: hotpot.dish, hint: hotpot.hint });
  assert.deepEqual(menuShop(guidebook.food, 'Tainan City', rujie.id, 'pick'),
    { city_en: 'Tainan City', city_zh: tainan.city_zh, name: rujie.name, hint: rujie.hint });
  assert.deepEqual(menuShop(guidebook.food, 'Tainan City', milkfish.id, 'dish'),
    { city_en: 'Tainan City', city_zh: tainan.city_zh, dish: milkfish.dish });
  assert.equal(menuShop(guidebook.food, 'Tainan City', 'no-such-pick', 'pick'), null);
  assert.equal(menuShop(guidebook.food, 'Tainan City', hotpot.id, 'dish'), null, 'a pick id is not a dish');
  assert.equal(menuShop(guidebook.food, 'Atlantis', hotpot.id, 'pick'), null);
  assert.equal(menuShop(undefined, 'Tainan City', hotpot.id, 'pick'), null);
});

test('the menu prompt of a pick names it and its dish (prefilled from the sheet)', () => {
  const p = buildPhotoPrompt(photoContext(s(), menuShop(guidebook.food, 'Tainan City', hotpot.id, 'pick')), 'menu', 'en');
  assert.ok(p.includes(`I'm at ${hotpot.name}, a place to eat in Tainan City (${tainan.city_zh})`));
  assert.ok(p.includes(`Recommended here: ${hotpot.dish.en} (${hotpot.dish.zh_TW}).`));
  assert.ok(p.includes(`Their tip: ${hotpot.hint.en}`));
});

test('menuPromptSheet: the steps, the copy failure when it failed, AI links and the escaped prompt', () => {
  for (const L of ['en', 'zh_TW']) {
    const ok = menuPromptSheet('Menu <b>& more', true, L);
    assert.ok(ok.includes(`<p class="small">${tr(L, 'menuSteps')}</p>`), L);
    assert.ok(!ok.includes(tr(L, 'copyFailPreview')), L);
    assert.ok(ok.includes(aiLinks(L)), L);
    assert.ok(ok.includes(`<pre class="prompt">${esc('Menu <b>& more')}</pre>`), L);
    assert.ok(menuPromptSheet('x', false, L).includes(`<p class="small muted">${tr(L, 'copyFailPreview')}</p>`), L);
  }
});

test('no dietary or factual claim in the UI strings of the feature', () => {
  const keys = ['photoMode', 'photoIntro', 'photoWhat', 'photoNote', 'photoCopied', 'askMenu', 'menuSteps',
    ...PHOTO_KINDS.flatMap(k => [`photo.${k}`, `photo.${k}.hint`])];
  for (const k of keys) {
    assert.notEqual(tr('en', k), k, `en ${k}`);
    assert.notEqual(tr('zh_TW', k), tr('en', k), `zh_TW ${k}`);
    assert.doesNotMatch(tr('en', k), /\b(safe|halal|vegan|vegetarian|contains|free of|no pork)\b/i, k);
  }
});
