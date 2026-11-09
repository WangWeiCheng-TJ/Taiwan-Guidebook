// Ask later in app/js/main.js, driven in the fake browser (tests/fake-dom.js): every prompt the app copies (the
// Ask AI tab, Copy for AI on a place, Ask AI about the menu, the select-text bar) is kept in a short list under
// tg.asklater.v1; the list's Copy, Delete, Clear all and Show all; and when the browser comes back online with items
// copied offline, a toast and a dot on the Ask AI tab. One module instance per file: the tests share the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const KEY = 'tg.asklater.v1';
const dom = installDom({ hash: '#/ask', guidebook });
// A list stored before this page: one item copied offline yesterday, one damaged
dom.store.set(KEY, JSON.stringify([
  { id: 'old', at: '2026-11-09T06:00:00.000Z', kind: 'explain', subject: '牌坊', where: 'Confucius Temple', prompt: 'old prompt', waiting: true },
  { id: 'bad', kind: 'chat', prompt: 'x' },
]));

const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { esc } = await import('../../app/js/util.js');
const { laterLabel } = await import('../../app/js/asklater.js');
await import('../../app/js/main.js');
await settle();

/** The clipboard: what was copied last; `fail` makes writeText reject (the fake has no execCommand fallback). */
const clip = { text: null, fail: false };
navigator.clipboard = { writeText: async t => { if (clip.fail) throw new Error('denied'); clip.text = t; } };
dom.document.body.appendChild = () => {};
dom.document.createElement = tag => Object.assign(new FakeElement(dom.document, { tag }), { style: {}, select() {}, remove() {} });

// #ask-later and #prompt-preview, as renderAsk draws them (the fake does not parse #view's HTML)
const slot = new FakeElement(dom.document, { parent: dom.view });
dom.document.byId['ask-later'] = slot;
dom.document.byId['prompt-preview'] = new FakeElement(dom.document, { tag: 'pre' });

const toastText = () => dom.document.getElementById('toast').textContent;
const stored = () => JSON.parse(dom.store.get(KEY) ?? 'null');
const go = async hash => { dom.location.hash = hash; await settle(); };
/** A click on a control inside #view or the sheet, through that container's listener (main.js dispatchClick). */
const click = async (dataset, parent = dom.view) => {
  parent.listeners.click[0]({ target: dom.control(dataset, {}, parent), preventDefault() {} });
  await settle();
};
const askTab = () => dom.document.tabs.find(a => a.dataset.tab === 'ask');
const byId = id => state.later.find(x => x.id === id);
/** @type {string[]} */
const asked = [];
let answer = true;
globalThis.confirm = msg => { asked.push(msg); return answer; };

test('the list stored on the device is read back, re-validated', () => {
  assert.deepEqual(state.later.map(x => x.id), ['old']);
  assert.equal(state.later[0].waiting, true);
  assert.ok(dom.view.innerHTML.includes('<section class="panel later"'), 'drawn on the Ask AI tab');
});

test('Copy question on the Ask AI tab: the prompt goes first in Ask later, stored, and the list is drawn again', async () => {
  state.lang = 'en';
  await click({ action: 'copy-prompt' });
  assert.match(clip.text, /My question: /);
  assert.equal(toastText(), tr('en', 'copied'));
  const first = state.later[0];
  assert.equal(first.prompt, clip.text);
  assert.equal(first.kind, 'near');
  assert.equal(first.waiting, false, 'copied online');
  assert.deepEqual(stored().map(x => x.id), state.later.map(x => x.id));
  assert.ok(slot.innerHTML.includes(esc(laterLabel(first, 'en'))), 'the list on the tab shows it');
});

test('the same prompt copied again is kept once', async () => {
  const n = state.later.length;
  await click({ action: 'copy-prompt' });
  assert.equal(state.later.length, n);
  assert.equal(state.later[0].prompt, clip.text);
});

test('Copy for AI on a place is kept as "About <place> · <city>"', async () => {
  await go('#/place/chihkan-tower');
  await click({ action: 'copy-place', id: 'chihkan-tower' });
  assert.equal(toastText(), tr('en', 'copiedPlace'));
  assert.equal(state.later[0].prompt, clip.text);
  assert.equal(laterLabel(state.later[0], 'en'), 'About Chihkan Tower (Fort Provintia) · Tainan City');
});

test('the select-text bar\'s prompt is kept as "About 魁星 · <place it was on>"', async () => {
  const p = new FakeElement(dom.document, { tag: 'p', parent: dom.view });
  dom.document.getSelection = () => ({
    toString: () => '魁星', anchorNode: { nodeType: 3, parentElement: p }, containsNode: () => false, removeAllRanges() {},
  });
  dom.document.dispatch('selectionchange');
  await new Promise(r => setTimeout(r, 300)); // the bar waits for the selection to settle
  const askbar = dom.document.getElementById('askbar');
  assert.equal(askbar.hidden, false);
  await askbar.listeners.click[0]();
  await settle();
  assert.match(clip.text, /What does "魁星" mean here\?/);
  assert.equal(state.later[0].prompt, clip.text);
  assert.equal(laterLabel(state.later[0], 'en'), 'About 魁星 · Chihkan Tower (Fort Provintia)');
  dom.document.dispatch('keydown', { key: 'Escape' });
  await settle();
  dom.document.getSelection = () => null;
});

test('"Ask AI about the menu" is kept as "Menu: <shop> · <city>"', async () => {
  await go('#/explore');
  await click({ action: 'food-sheet', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot' });
  await click({ action: 'ask-menu', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot', kind: 'pick' }, dom.sheet);
  assert.equal(state.later[0].prompt, clip.text);
  assert.equal(laterLabel(state.later[0], 'en'), 'Menu: 小豪洲沙茶火鍋 · Tainan City');
  dom.document.dispatch('keydown', { key: 'Escape' });
  await settle();
  assert.equal(dom.sheet.hidden, true);
});

test('offline, a copy is flagged waiting and the message says it stays in Ask later', async () => {
  await go('#/ask');
  navigator.onLine = false;
  dom.view.listeners.input[0]({ target: dom.control({ input: 'question' }, { value: 'Where can I buy an umbrella?' }) });
  await click({ action: 'copy-prompt' });
  assert.match(clip.text, /Where can I buy an umbrella\?/);
  assert.equal(toastText(), tr('en', 'later.keptOffline'));
  assert.equal(state.later[0].waiting, true);
  assert.equal(state.later[0].subject, 'Where can I buy an umbrella?');
  assert.equal(stored()[0].waiting, true);
  assert.ok(slot.innerHTML.includes(tr('en', 'later.waiting')));
});

test('back online on another tab: a toast and a dot on the Ask AI tab, named for screen readers, until Ask AI is shown', async () => {
  await go('#/explore');
  navigator.onLine = true;
  dom.fire('online');
  assert.equal(toastText(), tr('en', 'later.onlineN', { n: 2 }), 'yesterday\'s and the umbrella');
  assert.ok(askTab().classList.contains('has-dot'));
  assert.equal(askTab().getAttribute('aria-label'), tr('en', 'later.tabWaiting', { tab: 'Ask AI', n: 2 }));
  assert.ok(!dom.document.tabs.find(a => a.dataset.tab === 'log').classList.contains('has-dot'));

  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.equal(askTab().getAttribute('aria-label'), tr('zh_TW', 'later.tabWaiting', { tab: '問 AI', n: 2 }));
  dom.document.getElementById('lang-toggle').listeners.click[0]();

  await go('#/place/chihkan-tower');
  assert.ok(askTab().classList.contains('has-dot'), 'still there on another page');
  await go('#/ask');
  assert.equal(askTab().classList.contains('has-dot'), false);
  assert.equal(askTab().getAttribute('aria-label'), null);
  await go('#/explore');
  assert.equal(askTab().classList.contains('has-dot'), false, 'seen: it does not come back by itself');
});

test('back online on the Ask AI tab: the toast only', async () => {
  await go('#/ask');
  dom.fire('online');
  assert.equal(toastText(), tr('en', 'later.onlineN', { n: 2 }));
  assert.equal(askTab().classList.contains('has-dot'), false);
});

test('Copy in the list: copies the prompt; online it stops waiting, offline it keeps waiting', async () => {
  navigator.onLine = false;
  await click({ action: 'later-copy', id: 'old' });
  assert.equal(clip.text, 'old prompt');
  assert.equal(toastText(), tr('en', 'later.keptOffline'));
  assert.equal(byId('old').waiting, true);

  navigator.onLine = true;
  const order = state.later.map(x => x.id);
  await click({ action: 'later-copy', id: 'old' });
  assert.equal(toastText(), tr('en', 'copied'));
  assert.equal(byId('old').waiting, false);
  assert.equal(stored().find(x => x.id === 'old').waiting, false);
  assert.deepEqual(state.later.map(x => x.id), order, 'the rows do not move');

  const menu = state.later.find(x => x.kind === 'menu');
  await click({ action: 'later-copy', id: menu.id });
  assert.equal(toastText(), tr('en', 'photoCopied'), 'a menu prompt: attach the photo');
});

test('online with one item waiting says "1 question"; with none, nothing', async () => {
  dom.fire('online');
  assert.equal(toastText(), tr('en', 'later.online1'));
  const umbrella = state.later.find(x => x.waiting);
  await click({ action: 'later-copy', id: umbrella.id });
  dom.document.getElementById('toast').textContent = '';
  await go('#/explore');
  dom.fire('online');
  assert.equal(toastText(), '');
  assert.equal(askTab().classList.contains('has-dot'), false);
  await go('#/ask');
});

test('a failed copy from the list shows the prompt in a sheet, to select by hand', async () => {
  clip.fail = true;
  const it = state.later[0];
  await click({ action: 'later-copy', id: it.id });
  assert.equal(dom.sheet.hidden, false);
  assert.equal(dom.sheet.known['.sheet-title'].textContent, laterLabel(it, 'en'));
  const body = dom.sheet.known['.sheet-body'].innerHTML;
  assert.ok(body.includes(tr('en', 'copyFailPreview')));
  assert.ok(body.includes(`<pre class="prompt">${esc(it.prompt)}</pre>`));
  clip.fail = false;
  dom.document.dispatch('keydown', { key: 'Escape' });
  await settle();
});

test('a copy that failed is still kept (the list can copy it again)', async () => {
  clip.fail = true;
  dom.view.listeners.input[0]({ target: dom.control({ input: 'question' }, { value: 'Is the night market open on Monday?' }) });
  await click({ action: 'copy-prompt' });
  assert.equal(toastText(), tr('en', 'copyFailPreview'));
  assert.match(state.later[0].prompt, /night market open on Monday/);
  clip.fail = false;
});

test('a refused write does not spoil the copy: the message is the copy\'s, the list is kept for this session', async () => {
  dom.storage.failWrites = true;
  dom.view.listeners.input[0]({ target: dom.control({ input: 'question' }, { value: 'Quiet cafe nearby?' }) });
  await click({ action: 'copy-prompt' });
  assert.equal(toastText(), tr('en', 'copied'));
  assert.match(state.later[0].prompt, /Quiet cafe nearby\?/);
  dom.storage.failWrites = false;
});

test('the list keeps 10 at most', async () => {
  for (let i = 0; i < 12; i++) {
    dom.view.listeners.input[0]({ target: dom.control({ input: 'question' }, { value: `Question ${i}` }) });
    await click({ action: 'copy-prompt' });
  }
  assert.equal(state.later.length, 10);
  assert.equal(stored().length, 10);
  assert.match(state.later[0].prompt, /Question 11/);
  assert.ok(!state.later.some(x => x.id === 'old'), 'the oldest went');
});

test('Show all and Show fewer', async () => {
  assert.equal(state.laterAll, false);
  await click({ action: 'later-all' });
  assert.equal(state.laterAll, true);
  assert.ok(slot.innerHTML.includes('aria-expanded="true"'));
  assert.equal((slot.innerHTML.match(/data-action="later-copy"/g) || []).length, 10);
  await click({ action: 'later-all' });
  assert.equal(state.laterAll, false);
  assert.equal((slot.innerHTML.match(/data-action="later-copy"/g) || []).length, 3);
});

test('Delete removes one item, stores the list and tells screen readers', async () => {
  const id = state.later[1].id;
  await click({ action: 'later-delete', id });
  assert.ok(!byId(id));
  assert.equal(state.later.length, 9);
  assert.ok(!stored().some(x => x.id === id));
  assert.equal(dom.document.getElementById('announce').textContent, tr('en', 'later.removed'));
  assert.ok(!slot.innerHTML.includes(`data-id="${id}"`));

  const before = state.later;
  await click({ action: 'later-delete', id: 'nope' });
  assert.equal(state.later, before, 'an unknown id changes nothing');
});

test('Delete that the device refuses to store says so', async () => {
  dom.storage.failWrites = true;
  await click({ action: 'later-delete', id: state.later[0].id });
  assert.equal(toastText(), tr('en', 'storageFail'));
  dom.storage.failWrites = false;
});

test('the backup export never holds Ask later', async () => {
  const prompts = state.later.map(x => x.prompt);
  /** @type {Blob[]} */
  const downloads = [];
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = b => { downloads.push(b); return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  await go('#/log');
  await click({ action: 'export' });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  assert.equal(downloads.length, 1);
  const text = await downloads[0].text();
  assert.ok(prompts.length > 0);
  for (const p of prompts) assert.ok(!text.includes(p), 'a prompt is in the export');
  assert.ok(!text.includes('asklater'));
  await go('#/ask');
});

test('Clear all asks first: Cancel keeps the list, OK empties it on the device', async () => {
  answer = false;
  const before = state.later;
  await click({ action: 'later-clear' });
  assert.equal(asked.at(-1), tr('en', 'later.clearConfirm'));
  assert.equal(state.later, before);

  answer = true;
  state.laterAll = true;
  await click({ action: 'later-clear' });
  assert.deepEqual(state.later, []);
  assert.deepEqual(stored(), []);
  assert.equal(state.laterAll, false);
  assert.equal(toastText(), tr('en', 'later.cleared'));
  assert.equal(slot.innerHTML, '', 'the list is gone from the tab');

  const n = asked.length;
  await click({ action: 'later-clear' });
  assert.equal(asked.length, n, 'nothing to clear: no question');
});
