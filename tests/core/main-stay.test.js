// My stay in app/js/main.js, driven in the fake browser (tests/fake-dom.js): stored under tg.stay.v1 only by
// main.js, one per city (asking before a replacement), "Take me back" opens the show card, and the stay stays
// out of the export and out of the select-text "Ask AI" bar. The hotels here are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const tainan = { id: 'a', name: '範例旅店', address: '臺南市中西區範例路1號', phone: '06-221-0000', city: '' };

const dom = installDom({ hash: '#/explore', guidebook });
// Stored before the app starts: one good stay, one damaged
dom.store.set('tg.stay.v1', JSON.stringify([tainan, { id: 'x', name: 'No address' }]));

globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak() {} };

const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { STAY_KEY, staySay } = await import('../../app/js/stay.js');
const { stayCard } = await import('../../app/js/views/stay.js');
await import('../../app/js/main.js');
await settle();

const toastText = () => dom.document.getElementById('toast').textContent;
const stored = () => JSON.parse(dom.store.get(STAY_KEY));
const go = async hash => { dom.location.hash = hash; await settle(); };
const click = dataset => dom.view.listeners.click[0]({ target: dom.control(dataset), preventDefault() {} });
const submit = () => dom.view.listeners.submit[0]({ target: { dataset: { form: 'stay' } }, preventDefault() {} });
const field = (name, value) => ({ dataset: {}, name, value, form: { dataset: { form: 'stay' } } });
const type = (name, value) => dom.view.listeners.input[0]({ target: field(name, value) });
/** @type {string[]} */
let asked = [];
let answer = true;
globalThis.confirm = msg => { asked.push(msg); return answer; };

test('the stored stays are re-validated when the app starts', () => {
  assert.deepEqual(state.stays, [tainan]);
});

test('Explore offers Take me back for the only stay', () => {
  assert.match(dom.view.innerHTML, /data-action="stay-card" data-id="a"/);
});

test('Take me back opens the show card: driver layout, 🔊 with the name and address, the phone to call', async () => {
  click({ action: 'stay-card', id: 'a' });
  await settle();
  assert.equal(dom.bigcard.hidden, false);
  const html = dom.bigcard.innerHTML;
  assert.ok(html.includes(`<div class="big-text">${stayCard(tainan)}</div>`));
  assert.ok(html.includes(`data-action="big-say" data-say="${staySay(tainan)}"`));
  assert.ok(html.includes('<a href="tel:062210000">06-221-0000</a>'));
  assert.equal(dom.document.activeElement, dom.bigClose);
  dom.bigcard.listeners.click[0]({ target: dom.control({ action: 'close-big' }, {}, dom.bigcard), preventDefault() {} });
  await settle();
  assert.equal(dom.bigcard.hidden, true);
  click({ action: 'stay-card', id: 'nope' });
  await settle();
  assert.equal(dom.bigcard.hidden, true, 'an unknown id opens nothing');
});

test('Remove asks first, then forgets the stay on the device; the form shows again', async () => {
  await go('#/log');
  assert.match(dom.view.innerHTML, /data-action="stay-remove" data-id="a"/);
  answer = false;
  click({ action: 'stay-remove', id: 'a' });
  assert.deepEqual(asked, [tr('en', 'stay.removeConfirm')]);
  assert.equal(state.stays.length, 1, 'cancelled');
  answer = true;
  click({ action: 'stay-remove', id: 'a' });
  assert.deepEqual(state.stays, []);
  assert.deepEqual(stored(), []);
  assert.match(dom.view.innerHTML, /data-form="stay"/);
  asked = [];
});

test('the form keeps what was typed across a re-render (the language switch)', async () => {
  type('name', '範例旅店');
  type('address', '臺南市中西區\n範例路1號');
  type('phone', '06-221-0000');
  await dom.view.listeners.change[0]({ target: field('city', '') });
  assert.deepEqual(state.stayDraft, { id: '', name: '範例旅店', address: '臺南市中西區\n範例路1號', phone: '06-221-0000', city: '' });
  const toggle = dom.document.getElementById('lang-toggle');
  toggle.dispatch('click');
  assert.ok(dom.view.innerHTML.includes('value="範例旅店"'));
  assert.ok(dom.view.innerHTML.includes(tr('zh_TW', 'stay.title')));
  toggle.dispatch('click');
  assert.equal(state.lang, 'en');
});

test('a draft that cannot be saved says why and stores nothing', () => {
  const draft = { ...state.stayDraft };
  type('address', 'No. 1, Example Rd, Tainan');
  submit();
  assert.equal(toastText(), 'The address has no Chinese in it. Paste the Chinese one: that is what a driver reads.');
  assert.deepEqual(stored(), []);
  state.stayDraft = draft;
});

test('saving: tidied, given an id, stored under tg.stay.v1, the form closed and emptied', () => {
  submit();
  assert.equal(toastText(), tr('en', 'stay.saved'));
  assert.equal(state.stays.length, 1);
  const [st] = state.stays;
  assert.equal(typeof st.id, 'string');
  assert.ok(st.id.length > 4);
  assert.deepEqual({ ...st, id: '' }, { id: '', name: '範例旅店', address: '臺南市中西區 範例路1號', phone: '06-221-0000', city: '' });
  assert.deepEqual(stored(), state.stays);
  assert.equal(state.stayOpen, false);
  assert.equal(state.stayDraft.name, '');
  assert.match(dom.view.innerHTML, /data-action="stay-add"/);
  assert.doesNotMatch(dom.view.innerHTML, /data-form="stay"/);
  assert.deepEqual(asked, []);
});

test('one stay per city: a second one in Tainan replaces the first, after asking', () => {
  const first = state.stays[0];
  click({ action: 'stay-add' });
  assert.equal(state.stayOpen, true);
  assert.match(dom.view.innerHTML, /data-action="stay-cancel"/);
  type('name', '新的旅店');
  type('address', '臺南市東區新路7號');
  answer = false;
  submit();
  assert.deepEqual(asked, [tr('en', 'stay.replaceConfirm', { city: 'Tainan City', name: first.name })]);
  assert.deepEqual(state.stays, [first], 'cancelled: nothing changes');
  assert.equal(state.stayOpen, true, 'the form stays open with the draft');
  answer = true;
  submit();
  assert.equal(state.stays.length, 1);
  assert.equal(state.stays[0].name, '新的旅店');
  assert.deepEqual(stored(), state.stays);
  asked = [];
});

test('a stay in another city is added beside it; Cancel closes the form', () => {
  click({ action: 'stay-add' });
  type('name', '測試飯店');
  type('address', '100台北市中正區測試路2號');
  submit();
  assert.deepEqual(asked, []);
  assert.deepEqual(state.stays.map(x => x.name), ['新的旅店', '測試飯店']);
  click({ action: 'stay-add' });
  type('name', 'half typed');
  click({ action: 'stay-cancel' });
  assert.equal(state.stayOpen, false);
  assert.equal(state.stayDraft.name, '');
});

test('Edit fills the form with the stay and saves it in place', () => {
  const [, tp] = state.stays;
  click({ action: 'stay-edit', id: tp.id });
  assert.deepEqual(state.stayDraft, tp);
  assert.equal(state.stayOpen, true);
  assert.ok(dom.view.innerHTML.includes('value="測試飯店"'));
  type('phone', '02-2311-0000');
  submit();
  assert.deepEqual(asked, [], 'its own city: nothing to replace');
  assert.deepEqual(state.stays.map(x => x.id), [state.stays[0].id, tp.id]);
  assert.equal(state.stays[1].phone, '02-2311-0000');
});

test('a refused write says so instead of "Saved"', () => {
  dom.storage.failWrites = true;
  click({ action: 'stay-edit', id: state.stays[0].id });
  submit();
  assert.equal(toastText(), tr('en', 'storageFail'));
  dom.storage.failWrites = false;
});

test('Explore with two stays: none without a position, the one in the picked city with one', async () => {
  await go('#/explore');
  assert.doesNotMatch(dom.view.innerHTML, /data-action="stay-card"/);
  await dom.view.listeners.change[0]({ target: { dataset: { change: 'pick-location' }, value: 'Taipei City' } });
  assert.match(dom.view.innerHTML, new RegExp(`data-action="stay-card" data-id="${state.stays[1].id}"`));
  click({ action: 'clear-location' });
});

test('the log export holds no stay', async () => {
  /** @type {Blob[]} */
  const blobs = [];
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = b => { blobs.push(b); return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  state.log = [{ id: 'n1', date: '2026-11-03', placeId: null, name: 'Tea shop', stars: 4, note: 'good' }];
  click({ action: 'export' });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  assert.equal(blobs.length, 1);
  const text = await blobs[0].text();
  assert.match(text, /Tea shop/);
  for (const st of state.stays) {
    for (const v of [st.name, st.address, st.phone]) if (v) assert.ok(!text.includes(v), v);
  }
  assert.doesNotMatch(text, /tg\.stay|"stays"/);
});

test('selecting text in My stay does not offer "Ask AI"; elsewhere it does', async () => {
  const askbar = dom.document.getElementById('askbar');
  const node = priv => Object.assign(new FakeElement(dom.document, { parent: dom.view }), {
    nodeType: 1,
    closest: sel => (priv && sel === '[data-private]' ? dom.view : null),
  });
  const select = async n => {
    dom.document.getSelection = () => ({ toString: () => '範例路', anchorNode: n, removeAllRanges() {} });
    dom.document.dispatch('selectionchange');
    await new Promise(r => setTimeout(r, 320));
  };
  await select(node(false));
  assert.equal(askbar.hidden, false, 'ordinary text');
  await select(node(true));
  assert.equal(askbar.hidden, true, 'My stay');

  // A selection that starts in ordinary text and runs into My stay
  await select(node(false));
  assert.equal(askbar.hidden, false);
  const priv = new FakeElement(dom.document, { parent: dom.view });
  const { querySelectorAll } = dom.document;
  dom.document.querySelectorAll = sel => (sel === '[data-private]' ? [priv] : querySelectorAll.call(dom.document, sel));
  dom.document.getSelection = () => ({ toString: () => '範例路', anchorNode: node(false), removeAllRanges() {},
    containsNode: (n, partly) => n === priv && partly === true });
  dom.document.dispatch('selectionchange');
  await new Promise(r => setTimeout(r, 320));
  assert.equal(askbar.hidden, true, 'runs into My stay');

  // The selection goes away while My stay is on the page: no error, the bar stays hidden
  await select(node(false));
  dom.document.getSelection = () => null;
  dom.document.dispatch('selectionchange');
  await new Promise(r => setTimeout(r, 320));
  assert.equal(askbar.hidden, true, 'no selection');
  dom.document.querySelectorAll = querySelectorAll;
  dom.document.getSelection = () => null;
});
