// app/js/main.js wiring, driven through its listeners in a fake browser (tests/fake-dom.js). Audit ui #3 (Back
// returns to the scroll position), #4 (Back closes an open overlay first), #5 (the pasted answer survives a
// re-render), #7 (a failed save is not covered by "Saved."), #8 (toasts stay in the page), #9 (malformed and
// unknown routes), #10 (focus into and out of overlays), #11 (labels in the UI language).
// One module instance per file: the tests run in order and share the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/explore', guidebook });
const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { emptyDraft } = await import('../../app/js/triplog.js');
await import('../../app/js/main.js');
await settle();

const toastText = () => dom.document.getElementById('toast').textContent;
const activeTab = () => dom.document.tabs.find(a => a.classList.contains('active'))?.dataset.tab;
const go = async hash => { dom.location.hash = hash; await settle(); };
const back = async () => { dom.history.back(); await settle(); };
const click = (dataset, parent) => dom.view.listeners.click[0]({ target: dom.control(dataset, {}, parent), preventDefault() {} });
const clickInSheet = dataset => dom.sheet.listeners.click[0]({ target: dom.control(dataset, {}, dom.sheet), preventDefault() {} });
const escape = () => dom.document.dispatch('keydown', { key: 'Escape' });

test('first render: Explore, its tab highlighted, the history entry stamped with a key', () => {
  assert.match(dom.view.innerHTML, /<h1>Explore<\/h1>/);
  assert.equal(activeTab(), 'explore');
  assert.equal(typeof dom.history.state.key, 'string');
  assert.equal(dom.history.scrollRestoration, 'manual');
});

// ---------- ui #9 ----------

test('a malformed escape in the hash renders the page instead of throwing', async () => {
  await go('#/place/%E0');
  assert.match(dom.view.innerHTML, /Place not found\./);
  assert.equal(activeTab(), 'explore');
  await go('#/learn/100%');
  assert.match(dom.view.innerHTML, /Topic not found\./);
});

test('an unknown route shows Explore and puts #/explore in the address bar', async () => {
  await go('#/foo');
  assert.equal(dom.location.hash, '#/explore');
  assert.equal(activeTab(), 'explore');
  assert.match(dom.view.innerHTML, /<h1>Explore<\/h1>/);
});

// ---------- ui #3 ----------

test('Back returns to where the reader was on the list; a new page opens at the top', async () => {
  await go('#/explore/');
  dom.window.scrollY = 1840;
  await go('#/place/chihkan-tower');
  assert.equal(dom.window.scrollY, 0, 'new page: top');
  dom.window.scrollY = 320;
  await back();
  assert.match(dom.location.hash, /^#\/explore/);
  assert.equal(dom.window.scrollY, 1840, 'Back: the list position');
  dom.history.forward();
  await settle();
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  assert.equal(dom.window.scrollY, 320, 'Forward: the place page position');
});

test('a route change moves focus to the new page (#view here: the fake has no h1)', async () => {
  await go('#/tips');
  assert.equal(dom.document.activeElement, dom.view);
  assert.equal(dom.view.getAttribute('tabindex'), '-1');
});

// ---------- ui #4 and #10 ----------

test('Back closes the driver card and stays on the place page', async () => {
  await go('#/place/chihkan-tower');
  const before = dom.entries();
  const opener = dom.control({ action: 'driver', id: 'chihkan-tower' });
  opener.focus();
  dom.view.listeners.click[0]({ target: opener, preventDefault() {} });
  assert.equal(dom.bigcard.hidden, false);
  assert.equal(dom.entries(), before + 1, 'the card has its own history entry');
  assert.equal(dom.document.activeElement, dom.bigClose, 'focus moves into the card');
  assert.ok(dom.view.inert, 'the page under it takes no focus');
  assert.equal(dom.bigcard.getAttribute('aria-label'), tr('en', 'bigCard'));

  await back();
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  assert.equal(dom.view.inert, false);
  assert.equal(dom.document.activeElement, opener, 'focus returns to the button that opened it');
});

test('a big card over a sheet: Back closes the card, then the sheet, then leaves the page', async () => {
  click({ action: 'phrase-sheet', id: 'hello' });
  assert.equal(dom.sheet.hidden, false);
  assert.equal(dom.sheetClose.getAttribute('aria-label'), tr('en', 'close'));
  clickInSheet({ action: 'show-phrase', id: 'hello' });
  assert.equal(dom.bigcard.hidden, false);
  assert.ok(dom.sheet.inert, 'the sheet under the card takes no focus');

  await back();
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.sheet.hidden, false);
  assert.equal(dom.sheet.inert, false);

  await back();
  assert.equal(dom.sheet.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');

  await back();
  assert.notEqual(dom.location.hash, '#/place/chihkan-tower');
});

test('closing from the page (Escape, close button, a tap on the card) steps back off the overlay\'s entry', async () => {
  await go('#/place/chihkan-tower');
  const n = dom.entries();
  click({ action: 'phrase-sheet', id: 'hello' });
  escape();
  await settle();
  assert.equal(dom.sheet.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  assert.equal(dom.history.state.overlays, undefined);

  click({ action: 'driver', id: 'chihkan-tower' });
  dom.bigcard.listeners.click[0]({ target: dom.bigcard });
  dom.bigcard.listeners.click[0]({ target: dom.bigcard }); // a double tap must not go back a page too
  await settle();
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');

  click({ action: 'phrase-sheet', id: 'hello' });
  clickInSheet({ action: 'close-sheet' });
  await settle();
  assert.equal(dom.sheet.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  assert.ok(dom.entries() <= n + 1, 'no pile of entries');
});

test('Forward into a closed overlay\'s entry steps back off it, so the next Back leaves the page', async () => {
  await go('#/place/chihkan-tower');
  click({ action: 'phrase-sheet', id: 'hello' });
  escape();
  await settle();
  dom.history.forward();
  await settle();
  assert.equal(dom.sheet.hidden, true, 'nothing reopens');
  assert.equal(dom.history.state.overlays, undefined, 'back on the page entry');
  await back();
  assert.notEqual(dom.location.hash, '#/place/chihkan-tower', 'not a dead Back press');
});

test('a route change closes an open big card (it used to stay over the new page)', async () => {
  await go('#/place/chihkan-tower');
  click({ action: 'driver', id: 'chihkan-tower' });
  assert.equal(dom.bigcard.hidden, false);
  await go('#/explore');
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.view.inert, false);
});

// ---------- ui #5 ----------

test('the pasted AI answer survives a re-render (language switch)', async () => {
  state.trip = null;
  await go('#/log');
  const box = dom.control({ input: 'ai-answer' }, { value: 'Day 1: <temple> & noodles' });
  dom.view.listeners.input[0]({ target: box });
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.ok(dom.view.innerHTML.includes('>Day 1: &lt;temple&gt; &amp; noodles</textarea>'));
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.equal(state.lang, 'en');
});

// ---------- ui #7 and #8 ----------

const plan = { title: 'Test day', days: [{ date: '2026-11-04', items: [{ place: 'chihkan-tower' }] }] };
const answer = `Here you go.\n\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``;

test('loading a pasted plan: "Plan loaded" when stored, the storage error when not (never both)', async () => {
  state.trip = null;
  state.pasteText = answer;
  click({ action: 'paste-plan' });
  assert.equal(toastText(), tr('en', 'planLoaded', { t: 'Test day' }));
  assert.equal(state.pasteText, '', 'the box empties once the plan loads');

  dom.storage.failWrites = true;
  state.pasteText = answer;
  click({ action: 'paste-plan' });
  assert.equal(toastText(), tr('en', 'storageFail'));
  assert.equal(state.trip.title, 'Test day', 'still loaded for this session');
  dom.storage.failWrites = false;
});

test('saving a note: "Saved." when stored, the storage error when not', () => {
  const submit = () => dom.view.listeners.submit[0]({ target: { dataset: { form: 'log' } }, preventDefault() {} });
  state.draft = { ...emptyDraft(''), name: 'Tea shop', note: 'good' };
  submit();
  assert.equal(toastText(), tr('en', 'saved'));

  dom.storage.failWrites = true;
  state.draft = { ...emptyDraft(''), name: 'Tea shop', note: 'again' };
  submit();
  assert.equal(toastText(), tr('en', 'storageFail'));
  dom.storage.failWrites = false;
});

test('importing a backup: the storage error replaces "Imported"; the file input is emptied', async () => {
  const file = { text: async () => JSON.stringify([{ id: 'imp1', date: '2026-11-01', placeId: null, name: 'Market', stars: 4, note: '' }]) };
  const input = dom.control({ change: 'import' }, { files: [file], value: 'C:\\fakepath\\log.json' });
  dom.storage.failWrites = true;
  await dom.view.listeners.change[0]({ target: input });
  assert.equal(toastText(), tr('en', 'storageFail'));
  assert.equal(input.value, '', 'the same file can be chosen again');
  dom.storage.failWrites = false;

  const bad = dom.control({ change: 'import' }, { files: [{ text: async () => 'not json' }], value: 'x' });
  await dom.view.listeners.change[0]({ target: bad });
  assert.equal(toastText(), tr('en', 'badImport'));
  assert.equal(bad.value, '');
});

test('the Import button opens the file picker', () => {
  let opened = false;
  dom.view.known['[data-change="import"]'] = dom.control({ change: 'import' }, { click() { opened = true; } });
  click({ action: 'import' });
  assert.ok(opened);
  delete dom.view.known['[data-change="import"]'];
});

test('the toast stays in the page (a live region): only its text changes', () => {
  const t = dom.document.getElementById('toast');
  assert.equal(t.hidden, false);
  assert.notEqual(t.textContent, '');
});

// ---------- ui #11 ----------

test('the language toggle\'s label follows the UI language', () => {
  const toggle = dom.document.getElementById('lang-toggle');
  assert.equal(toggle.getAttribute('aria-label'), tr('en', 'switchLabel'));
  toggle.listeners.click[0]();
  assert.equal(toggle.textContent, 'EN');
  assert.equal(toggle.getAttribute('aria-label'), tr('zh_TW', 'switchLabel'));
  toggle.listeners.click[0]();
});
