// The timeline page (#/learn/timeline) in app/js/main.js, driven in the fake browser (tests/fake-dom.js): the route
// renders it under the Good to know tab, and its Copy for AI copies the timeline and keeps it in Ask later.
// One module instance per file: the tests share the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/learn', guidebook });
const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { laterLabel } = await import('../../app/js/asklater.js');
const { buildTimelinePrompt } = await import('../../app/js/prompt.js');
const { mergeTimeline } = await import('../../app/js/timeline.js');
await import('../../app/js/main.js');
await settle();

/** The clipboard: what was copied last; `fail` makes writeText reject (the fake has no execCommand fallback). */
const clip = { text: null, fail: false };
navigator.clipboard = { writeText: async t => { if (clip.fail) throw new Error('denied'); clip.text = t; } };
dom.document.body.appendChild = () => {};
dom.document.createElement = tag => Object.assign(new FakeElement(dom.document, { tag }), { style: {}, select() {}, remove() {} });

const toastText = () => dom.document.getElementById('toast').textContent;
const activeTab = () => dom.document.tabs.find(a => a.classList.contains('active'))?.dataset.tab;
const go = async hash => { dom.location.hash = hash; await settle(); };
const click = async dataset => {
  dom.view.listeners.click[0]({ target: dom.control(dataset, {}, dom.view), preventDefault() {} });
  await settle();
};

test('the Learn page links to the timeline; #/learn/timeline shows it under Good to know', async () => {
  assert.ok(dom.view.innerHTML.includes('href="#/learn/timeline"'));
  await go('#/learn/timeline');
  assert.match(dom.view.innerHTML, /<h1>Taiwan through the places<\/h1>/);
  assert.ok(dom.view.innerHTML.includes('data-action="copy-timeline"'));
  assert.equal(activeTab(), 'tips');
});

test('Copy for AI copies the timeline in the UI language and keeps it in Ask later', async () => {
  await click({ action: 'copy-timeline' });
  assert.equal(clip.text, buildTimelinePrompt(mergeTimeline(guidebook.places), 'en'));
  assert.equal(toastText(), tr('en', 'copied'));
  assert.equal(state.later[0].prompt, clip.text);
  assert.equal(laterLabel(state.later[0], 'en'), 'About Taiwan through the places');
  assert.equal(JSON.parse(dom.store.get('tg.asklater.v1'))[0].prompt, clip.text);

  state.lang = 'zh_TW';
  await click({ action: 'copy-timeline' });
  assert.match(clip.text, /Please reply in Traditional Chinese \(Taiwan\)\.$/);
  assert.equal(laterLabel(state.later[0], 'zh_TW'), '關於從景點看台灣');
  state.lang = 'en';
});

test('a failed copy says so, and the timeline is still kept in Ask later', async () => {
  clip.fail = true;
  const n = state.later.length;
  state.later = [];
  await click({ action: 'copy-timeline' });
  assert.equal(toastText(), tr('en', 'copyFail'));
  assert.equal(state.later.length, 1);
  assert.equal(state.later[0].prompt, buildTimelinePrompt(mergeTimeline(guidebook.places), 'en'));
  clip.fail = false;
  assert.ok(n > 0);
});
