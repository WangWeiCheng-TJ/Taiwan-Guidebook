// Ask later on the Ask AI tab (views/ask.js renderLater, laterInfo): the list of copied prompts above the
// question builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import { esc } from '../../app/js/util.js';
import { laterItem, laterLabel } from '../../app/js/asklater.js';
import { renderAsk, renderLater, laterInfo, questionText } from '../../app/js/views/ask.js';
import { guidebook } from '../fixtures.js';

state.data = guidebook;
const s = (over = {}, ask = {}) => ({ ...state, data: guidebook, lang: 'en', log: [], trip: null, pos: null, later: [],
  laterAll: false, ask: { ...state.ask, ...ask }, ...over });
const now = new Date(2026, 10, 10, 18, 0);
const item = (id, extra = {}) => laterItem({ id, at: new Date(2026, 10, 10, 14, 5), kind: 'explain', subject: `魁星${id}`,
  where: 'Chihkan Tower', prompt: `prompt ${id}`, ...extra });
const five = ['e', 'd', 'c', 'b', 'a'].map(id => item(id));

test('an empty list draws nothing; the Ask AI tab still has the #ask-later slot', () => {
  assert.equal(renderLater(s(), now), '');
  assert.ok(renderAsk(s()).includes('<div id="ask-later"></div>'));
});

test('the list sits at the top of the Ask AI tab, under the heading and before the builder', () => {
  const out = renderAsk(s({ later: [item('a')] }));
  const h1 = out.indexOf('<h1>');
  const list = out.indexOf('<section class="panel later"');
  assert.ok(h1 >= 0 && list > h1, 'after the heading');
  assert.ok(list < out.indexOf('data-action="mode"'), 'before the mode switch');
  assert.ok(list < out.indexOf('data-action="copy-prompt"'));
});

test('each item: its label, its time, Copy and Delete with labels that name it; Clear all', () => {
  for (const L of /** @type {const} */ (['en', 'zh_TW'])) {
    const it = item('a');
    const out = renderLater(s({ lang: L, later: [it] }), now);
    const label = laterLabel(it, L);
    assert.ok(out.includes(`<h2 id="later-title">${tr(L, 'later.title')}</h2>`), L);
    assert.ok(out.includes('aria-labelledby="later-title"'), L);
    assert.ok(out.includes(tr(L, 'later.intro')), L);
    assert.ok(out.includes(`<div class="title">${esc(label)}</div>`), L);
    assert.ok(out.includes('<div class="meta">14:05</div>'), L);
    assert.ok(out.includes(`data-action="later-copy" data-id="a" aria-label="${esc(tr(L, 'later.copyLabel', { t: label }))}">${tr(L, 'later.copy')}</button>`), L);
    assert.ok(out.includes(`data-action="later-delete" data-id="a" aria-label="${esc(tr(L, 'later.deleteLabel', { t: label }))}">✕</button>`), L);
    assert.ok(out.includes(`data-action="later-clear">${tr(L, 'later.clear')}</button>`), L);
  }
  assert.ok(renderLater(s({ later: [item('a')] }), now).includes('About 魁星a · Chihkan Tower'));
});

test('an item copied offline says so; one copied online does not', () => {
  const out = renderLater(s({ later: [item('a', { offline: true }), item('b')] }), now);
  assert.equal(out.split(tr('en', 'later.waiting')).length - 1, 1);
  assert.ok(out.includes(`14:05 <span class="badge warm">${tr('en', 'later.waiting')}</span>`));
});

test('the newest three, then "Show all"; laterAll shows every item and "Show fewer"', () => {
  const few = renderLater(s({ later: five }), now);
  assert.deepEqual([...few.matchAll(/data-action="later-copy" data-id="(\w)"/g)].map(m => m[1]), ['e', 'd', 'c']);
  assert.ok(few.includes(`data-action="later-all" aria-expanded="false">${tr('en', 'later.showAll', { n: 5 })}</button>`));
  const all = renderLater(s({ later: five, laterAll: true }), now);
  assert.deepEqual([...all.matchAll(/data-action="later-copy" data-id="(\w)"/g)].map(m => m[1]), ['e', 'd', 'c', 'b', 'a']);
  assert.ok(all.includes(`data-action="later-all" aria-expanded="true">${tr('en', 'later.showFewer')}</button>`));
  assert.ok(!renderLater(s({ later: five.slice(0, 3) }), now).includes('later-all'), 'three or fewer: no toggle');
});

test('labels and ids are escaped', () => {
  const bad = laterItem({ id: 'x"><b>', at: now, kind: 'explain', subject: '<img src=x>', where: '"&', prompt: 'P' });
  const out = renderLater(s({ later: [bad] }), now);
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('<b>'));
  assert.ok(out.includes('About &lt;img src=x&gt; · &quot;&amp;'));
});

test('the prompt itself is not drawn (it can hold the traveller\'s notes; Copy puts it on the clipboard)', () => {
  const it = laterItem({ id: 'x', at: now, kind: 'near', subject: 'Q', prompt: 'SECRET NOTE TEXT' });
  assert.ok(!renderLater(s({ later: [it] }), now).includes('SECRET NOTE TEXT'));
});

test('laterInfo: near me is the question and the picked city; GPS has no place name', () => {
  const picked = { lat: 23, lng: 120.2, source: 'pick', label: 'Tainan City', city: 'Tainan City' };
  assert.deepEqual(laterInfo(s({ pos: picked })), { kind: 'near', subject: questionText(s()), where: 'Tainan City' });
  assert.equal(laterInfo(s({ pos: picked, lang: 'zh_TW' })).where, '臺南市');
  assert.equal(laterInfo(s({ pos: { lat: 23, lng: 120.2, source: 'gps', label: 'your location' } })).where, '');
  assert.equal(laterInfo(s({}, { question: 'Where is good tea?' })).subject, 'Where is good tea?');
});

test('laterInfo: plan a day is the area, else the question; photo is the preset', () => {
  assert.deepEqual(laterInfo(s({}, { mode: 'plan', area: 'city:Tainan City' })), { kind: 'plan', subject: 'Tainan City', where: '' });
  assert.equal(laterInfo(s({}, { mode: 'plan', area: 'custom', customArea: "  Da'an " })).subject, "Da'an");
  const noArea = s({}, { mode: 'plan', area: 'custom', customArea: '' });
  assert.equal(laterInfo(noArea).subject, questionText(noArea));
  assert.deepEqual(laterInfo(s({}, { mode: 'photo', photo: 'board' })), { kind: 'photo', subject: 'board', where: '' });
});
