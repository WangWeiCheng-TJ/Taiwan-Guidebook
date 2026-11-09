// app/js/views/stay.js: My stay on My trip, "Take me back" on Explore, the stay's show card; and the stay
// kept out of every Ask AI prompt and out of the log export. The hotels here are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import { emptyStay, staySay } from '../../app/js/stay.js';
import { renderStaySection, stayHereRow, stayCard } from '../../app/js/views/stay.js';
import { renderLog } from '../../app/js/views/log.js';
import { renderExplore } from '../../app/js/views/explore.js';
import { driverCard } from '../../app/js/views/place.js';
import { askContext, currentPrompt, photoContext } from '../../app/js/views/ask.js';
import { buildAskPrompt, buildPhotoPrompt, buildPlacePrompt } from '../../app/js/prompt.js';
import { exportPayload } from '../../app/js/triplog.js';
import { cityCenter } from '../../app/js/data.js';
import { guidebook, places, chihkan, tainanStation, sampleLog } from '../fixtures.js';

state.data = guidebook;
const tainan = { id: 'a', name: '範例旅店', address: '臺南市中西區範例路1號', phone: '06-221-0000', city: '' };
const taipei = { id: 'b', name: '測試飯店', address: '100台北市中正區測試路2號', phone: '', city: '' };
// lang set: state.lang follows the machine's language under Node
const s = (over = {}) => ({ ...state, data: guidebook, lang: 'en', stays: [], stayDraft: emptyStay(), stayOpen: false, ...over });
const pick = city => ({ ...cityCenter(places, city), source: 'pick', label: city, city });

test('the intro says the stay is kept on this device only, in both languages', () => {
  assert.match(tr('en', 'stay.intro'), /on this device only/);
  assert.match(tr('zh_TW', 'stay.intro'), /只存在這台裝置上/);
  for (const L of ['en', 'zh_TW']) assert.ok(renderStaySection(s({ lang: L })).includes(tr(L, 'stay.intro')), L);
});

test('My trip: no stay yet shows the form, with no Cancel', () => {
  const out = renderLog(s());
  assert.ok(out.includes(`<h2>${tr('en', 'stay.title')}</h2>`));
  assert.match(out, /<form class="card stack" data-form="stay" data-private>/);
  for (const f of ['name', 'address', 'phone', 'city']) assert.match(out, new RegExp(`name="${f}"`), f);
  assert.match(out, /<input name="phone" type="tel"/);
  assert.doesNotMatch(out, /data-action="stay-cancel"/);
  assert.doesNotMatch(out, /data-action="stay-add"/);
  // My stay sits between the plan and the notes
  assert.ok(out.indexOf(tr('en', 'stay.title')) < out.indexOf(`<h2>${tr('en', 'notes')}</h2>`));
});

test('the form holds the draft (escaped) and offers the guidebook cities', () => {
  const out = renderStaySection(s({ stayDraft: { ...emptyStay(), name: '<b>旅店</b>', address: '臺南市"1號"', phone: '06', city: 'Tainan City' } }));
  assert.ok(out.includes('value="&lt;b&gt;旅店&lt;/b&gt;"'));
  assert.ok(out.includes('>臺南市&quot;1號&quot;</textarea>'));
  assert.ok(out.includes('<option value="Tainan City" selected>Tainan City</option>'));
  for (const c of ['Changhua County', 'New Taipei City', 'Taipei City']) assert.ok(out.includes(`<option value="${c}" >`), c);
  assert.ok(out.includes(`<option value="">${tr('en', 'stay.cityNone')}</option>`));
  const zh = renderStaySection(s({ lang: 'zh_TW' }));
  assert.ok(zh.includes('<option value="Tainan City" >臺南市</option>'), 'city names in the UI language');
  // the Chinese fields say so to a screen reader
  assert.match(out, /<input name="name" lang="zh-TW"/);
  assert.match(out, /<textarea name="address" lang="zh-TW"/);
});

test('a stay saved for a city no longer in the guidebook keeps its city in the form', () => {
  const out = renderStaySection(s({ stayOpen: true, stays: [tainan], stayDraft: { ...tainan, city: 'Hualien County' } }));
  assert.ok(out.includes('<option value="Hualien County" selected>Hualien County</option>'));
});

test('saved stays: Take me back, Edit and Remove, labelled with the name; the form behind Add a stay', () => {
  const out = renderLog(s({ stays: [tainan, taipei] }));
  for (const st of [tainan, taipei]) {
    assert.ok(out.includes(`<span class="title" lang="zh-TW">${st.name}</span>`), st.id);
    assert.ok(out.includes(`<div lang="zh-TW">${st.address}</div>`), st.id);
    assert.ok(out.includes(`data-action="stay-card" data-id="${st.id}" aria-label="${tr('en', 'stay.backTo', { name: st.name })}">${tr('en', 'stay.back')}<`));
    assert.ok(out.includes(`data-action="stay-edit" data-id="${st.id}" aria-label="${tr('en', 'stay.editLabel', { name: st.name })}">`));
    assert.ok(out.includes(`data-action="stay-remove" data-id="${st.id}" aria-label="${tr('en', 'stay.removeLabel', { name: st.name })}">`));
  }
  // the phone is a tel: link; the city comes from the address
  assert.ok(out.includes('<a href="tel:062210000">06-221-0000</a>'));
  assert.ok(out.includes('<span class="badge">Tainan City</span>'));
  assert.ok(out.includes('<span class="badge">Taipei City</span>'));
  assert.doesNotMatch(out, /data-form="stay"/);
  assert.match(out, /data-action="stay-add"/);
  // the accessible names contain the visible text (voice control)
  for (const L of ['en', 'zh_TW']) assert.ok(tr(L, 'stay.backTo', { name: 'x' }).includes(tr(L, 'stay.back')), L);

  const open = renderLog(s({ stays: [tainan], stayOpen: true }));
  assert.match(open, /data-form="stay"/);
  assert.match(open, /data-action="stay-cancel"/);
  assert.doesNotMatch(open, /data-action="stay-add"/);
});

test('every part of My stay is marked data-private (no select-to-ask)', () => {
  const out = renderStaySection(s({ stays: [tainan], stayOpen: true }));
  assert.equal((out.match(/data-private/g) || []).length, 2, 'the stay row and the form');
  assert.match(stayHereRow(s({ stays: [tainan] })), /^<div class="panel row spread" data-private>/);
});

test('a name with markup is escaped everywhere', () => {
  const evil = { ...tainan, name: '<img src=x onerror=alert(1)>', phone: '06-221-0000"><script>' };
  for (const out of [renderStaySection(s({ stays: [evil] })), stayHereRow(s({ stays: [evil] })), stayCard(evil)]) {
    assert.doesNotMatch(out, /<img|<script/);
  }
});

test('Explore: Take me back for the stay here, between the plan card and the location panel', () => {
  assert.equal(stayHereRow(s()), '');
  const one = renderExplore(s({ stays: [tainan] }));
  assert.ok(one.includes(`data-action="stay-card" data-id="a"`));
  assert.ok(one.includes(`<span class="small">Your stay: <b lang="zh-TW">範例旅店</b></span>`));
  assert.ok(stayHereRow(s({ lang: 'zh_TW', stays: [tainan] })).includes('你的住宿：<b lang="zh-TW">範例旅店</b>'), 'no space after ：');
  assert.ok(one.indexOf('data-action="stay-card"') < one.indexOf('data-action="locate"'));

  assert.equal(stayHereRow(s({ stays: [tainan, taipei] })), '', 'several stays, no position: none');
  assert.match(stayHereRow(s({ stays: [tainan, taipei], pos: tainanStation })), /data-id="a"/);
  assert.match(stayHereRow(s({ stays: [tainan, taipei], pos: pick('Taipei City') })), /data-id="b"/);
  assert.match(stayHereRow(s({ stays: [tainan, taipei], pos: pick('New Taipei City') })), /data-id="b"/, 'nearest');
  assert.match(stayHereRow(s({ lang: 'zh_TW', stays: [tainan] })), new RegExp(`>${tr('zh_TW', 'stay.back')}</button>`));
});

test('the stay card has the driver card\'s layout, plus the phone as a tel: link', () => {
  const out = stayCard(tainan);
  const shape = html => [...html.matchAll(/<div class="(\w+)" lang="([\w-]+)">/g)].map(m => `${m[1]}:${m[2]}`);
  assert.deepEqual(shape(out).slice(0, 4), shape(driverCard(chihkan)));
  assert.ok(out.startsWith(`<div class="big" lang="zh-TW">範例旅店</div>`));
  assert.ok(out.includes(`<div class="mid" lang="zh-TW">臺南市中西區範例路1號</div>`));
  assert.ok(out.includes('請帶我到這裡，謝謝。'));
  assert.ok(out.includes('<div class="mid" lang="zh-TW">電話 <a href="tel:062210000">06-221-0000</a></div>'));
  assert.doesNotMatch(stayCard(taipei), /tel:|電話/, 'no phone, no line');
  assert.doesNotMatch(stayCard({ ...taipei, phone: 'ask at desk' }), /tel:/, 'not a number: no link');
});

test('privacy: the stay is in no Ask AI prompt', () => {
  const stays = [{ ...tainan, phone: '06-221-0009' }, taipei];
  const secrets = [...stays.map(x => x.name), ...stays.map(x => x.address), '06-221-0009', '0622100'];
  const base = s({ stays, log: sampleLog, pos: tainanStation, partySet: true, party: 3 });
  const prompts = [];
  for (const mode of ['near', 'plan', 'photo']) {
    for (const lang of ['en', 'zh_TW']) {
      const st = { ...base, lang, ask: { ...base.ask, mode, area: 'city:Tainan City', wantPlan: true } };
      prompts.push(currentPrompt(st), buildAskPrompt(askContext(st)), buildPhotoPrompt(photoContext(st), 'menu', lang));
    }
  }
  prompts.push(buildPlacePrompt(chihkan, []));
  for (const p of prompts) for (const x of secrets) assert.ok(!p.includes(x), x);
  // and the contexts carry no stay at all
  for (const ctx of [askContext(base), photoContext(base)]) {
    assert.deepEqual(Object.keys(ctx).filter(k => /stay/i.test(k)), []);
    assert.doesNotMatch(JSON.stringify(ctx), /範例旅店|測試飯店|範例路|測試路/);
  }
});

test('privacy: the log export holds the log only', () => {
  const out = JSON.stringify(exportPayload(sampleLog, new Date('2026-11-10T00:00:00Z')));
  assert.doesNotMatch(out, /範例旅店|臺南市中西區範例路|stay/i);
});

test('the show card speaks the name and address', () => {
  assert.equal(staySay(tainan), '範例旅店，臺南市中西區範例路1號');
});
