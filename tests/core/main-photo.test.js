// main.js wiring of "Ask AI about a photo", in a fake browser (tests/fake-dom.js): the Ask AI tab's photo mode
// and the food sheets' "Ask AI about the menu". One module instance per file: the tests share the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/ask', guidebook });
const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

/** The clipboard: what was copied last; `fail` makes writeText reject (the app then tries execCommand). */
const clip = { text: null, fail: false };
navigator.clipboard = { writeText: async t => { if (clip.fail) throw new Error('denied'); clip.text = t; } };
// The execCommand fallback needs a little more DOM than the fake has; the fake document has no execCommand,
// so the fallback reports failure.
dom.document.body.appendChild = () => {};
dom.document.createElement = tag => Object.assign(new FakeElement(dom.document, { tag }), { style: {}, select() {}, remove() {} });

const preview = new FakeElement(dom.document, { tag: 'pre' });
dom.document.byId['prompt-preview'] = preview;
const toastText = () => dom.document.getElementById('toast').textContent;
/** A click on a control inside #view or the sheet, through that container's listener (main.js dispatchClick). */
const click = (dataset, parent = dom.view) => parent.listeners.click[0]({ target: dom.control(dataset, {}, parent), preventDefault() {} });

test('the "About a photo" button switches the Ask AI tab to photo mode', () => {
  state.lang = 'en';
  state.partySet = false;
  click({ action: 'mode', mode: 'photo' });
  assert.equal(state.ask.mode, 'photo');
  assert.ok(dom.view.innerHTML.includes('data-change="photo-kind"'));
  assert.ok(dom.view.innerHTML.includes('aria-pressed="true">About a photo</button>'));
});

test('picking a preset updates the preview without a re-render', () => {
  const before = dom.view.innerHTML;
  dom.view.listeners.change[0]({ target: dom.control({ change: 'photo-kind' }, { value: 'board' }) });
  assert.equal(state.ask.photo, 'board');
  assert.match(preview.textContent, /The attached photo shows a departure board or timetable\./);
  assert.equal(dom.view.innerHTML, before, 'no re-render: focus stays on the radio button');
});

test('typing a note updates the preview', () => {
  dom.view.listeners.input[0]({ target: dom.control({ input: 'photo-note' }, { value: 'Going to Anping' }) });
  assert.equal(state.ask.photoNote, 'Going to Anping');
  assert.match(preview.textContent, /Also keep in mind: Going to Anping/);
});

test('Copy question copies the photo prompt and says to attach the photo', async () => {
  click({ action: 'copy-prompt' });
  await settle();
  assert.match(clip.text, /^\(Attach your photo to this message before you send it\.\)/);
  assert.match(clip.text, /departure board/);
  assert.doesNotMatch(clip.text, /We are|traveling alone/, 'party not set');
  assert.equal(toastText(), tr('en', 'photoCopied'));

  clip.fail = true;
  click({ action: 'copy-prompt' });
  await settle();
  assert.equal(toastText(), tr('en', 'copyFailPreview'));
  clip.fail = false;
});

test('the language switch keeps photo mode and rewrites the preview in the new language', () => {
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.equal(state.lang, 'zh_TW');
  assert.equal(state.ask.mode, 'photo');
  assert.match(preview.textContent, /^（送出前/);
  assert.match(preview.textContent, /Please reply in Traditional Chinese \(Taiwan\)\.$/);
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.equal(state.lang, 'en');
});

test('back in near mode, Copy question copies the Ask AI prompt as before', async () => {
  click({ action: 'mode', mode: 'near' });
  click({ action: 'copy-prompt' });
  await settle();
  assert.doesNotMatch(clip.text, /Attach your photo/);
  assert.match(clip.text, /My question: /);
  assert.equal(toastText(), tr('en', 'copied'));
});

test('"Ask AI about the menu" on a pick copies a menu prompt for that pick and shows the steps', async () => {
  dom.location.hash = '#/explore';
  await settle();
  click({ action: 'food-sheet', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot' });
  assert.equal(dom.sheet.hidden, false);
  assert.ok(dom.sheet.known['.sheet-body'].innerHTML.includes('data-action="ask-menu"'));

  clip.text = null;
  click({ action: 'ask-menu', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot', kind: 'pick' }, dom.sheet);
  await settle();
  assert.match(clip.text, /I'm at 小豪洲沙茶火鍋, a place to eat in Tainan City/);
  assert.match(clip.text, /Recommended here: Satay hot pot \(沙茶火鍋\)\./);
  assert.match(clip.text, /The attached photo shows a menu\./);
  assert.doesNotMatch(clip.text, /Going to Anping/, 'the Ask AI note was for another photo');
  assert.equal(toastText(), tr('en', 'copied'));
  assert.equal(dom.sheet.known['.sheet-title'].textContent, tr('en', 'askMenu'));
  const body = dom.sheet.known['.sheet-body'].innerHTML;
  assert.ok(body.includes(tr('en', 'menuSteps')));
  assert.ok(body.includes('Recommended here: Satay hot pot (沙茶火鍋).'), 'the prompt is shown too');
  assert.equal(dom.document.activeElement, dom.sheetClose, 'focus stays in the sheet');
});

test('"Ask AI about the menu" on a dish with no shop; a failed copy says so in the sheet', async () => {
  const milkfish = guidebook.food.find(c => c.city_en === 'Tainan City').to_try.find(d => d.dish.zh_TW === '虱目魚');
  clip.fail = true;
  click({ action: 'ask-menu', city: 'Tainan City', id: milkfish.id, kind: 'dish' }, dom.sheet);
  await settle();
  assert.equal(toastText(), tr('en', 'copyFailPreview'));
  const body = dom.sheet.known['.sheet-body'].innerHTML;
  assert.ok(body.includes(tr('en', 'copyFailPreview')));
  assert.ok(body.includes('to try a local dish: Milkfish (虱目魚).'));
  clip.fail = false;
});

test('an unknown pick does nothing', async () => {
  clip.text = null;
  const body = dom.sheet.known['.sheet-body'].innerHTML;
  click({ action: 'ask-menu', city: 'Tainan City', id: 'nope', kind: 'pick' }, dom.sheet);
  await settle();
  assert.equal(clip.text, null);
  assert.equal(dom.sheet.known['.sheet-body'].innerHTML, body);
});
