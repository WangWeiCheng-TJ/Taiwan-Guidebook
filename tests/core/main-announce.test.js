// What screen readers hear, in app/js/main.js and ui.js driven in the fake browser (tests/fake-dom.js):
// - the party stepper's new count (the re-render replaces the count, so a live region on it says nothing);
// - a toast while a sheet or the show card is open: #toast is outside that aria-modal dialog, so the message
//   also goes to the dialog's own status region (review: "Ask AI about the menu" never said it had copied).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/ask', guidebook });
navigator.clipboard = { writeText: async () => {} };
const { tr } = await import('../../app/js/lang.js');
const { partyControl } = await import('../../app/js/views/reference.js');
const { menuPromptSheet } = await import('../../app/js/views/food.js');
const { bigCardHtml } = await import('../../app/js/bigcard.js');
await import('../../app/js/main.js');
await settle();

const byId = id => dom.document.getElementById(id);
const sheetStatus = dom.sheet.querySelector('.sr-status');
const cardStatus = dom.bigcard.querySelector('.sr-status');
const click = (dataset, parent = dom.view) => dom.view.listeners.click[0]({ target: dom.control(dataset, {}, parent), preventDefault() {} });
const inSheet = dataset => dom.sheet.listeners.click[0]({ target: dom.control(dataset, {}, dom.sheet), preventDefault() {} });

test('the party stepper: each tap announces the new count; the re-rendered count is no live region', async () => {
  click({ action: 'party-inc' });
  assert.equal(byId('announce').textContent, 'People: 3');
  assert.match(dom.view.innerHTML, /<b class="party-n">3<\/b>/);
  click({ action: 'party-dec' });
  click({ action: 'party-dec' });
  assert.equal(byId('announce').textContent, 'People: 1');
  for (const L of ['en', 'zh_TW']) {
    assert.doesNotMatch(partyControl(L, 2), /aria-live/, L);
    assert.equal(tr(L, 'party.now', { n: 4 }), L === 'en' ? 'People: 4' : '人數：4');
  }
});

test('a toast with no sheet or card open stays in #toast only', async () => {
  byId('announce').textContent = '';
  click({ action: 'copy-prompt' });
  await settle();
  assert.equal(byId('toast').textContent, tr('en', 'copied'));
  assert.equal(byId('announce').textContent, '');
  assert.equal(sheetStatus.textContent, '');
});

test('"Ask AI about the menu": the copy is said inside the sheet, and the sheet shows it', async () => {
  click({ action: 'food-sheet', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot' });
  assert.equal(dom.sheet.hidden, false);
  inSheet({ action: 'ask-menu', city: 'Tainan City', id: 'xiao-hao-zhou-satay-hotpot', kind: 'pick' });
  await settle();
  assert.equal(byId('toast').textContent, tr('en', 'copied'));
  assert.equal(sheetStatus.textContent, tr('en', 'copied'), 'in the dialog, where a screen reader hears it');
  assert.ok(dom.sheet.querySelector('.sheet-body').innerHTML.includes(`<p class="small">${tr('en', 'copied')}</p>`));
  dom.sheet.listeners.click[0]({ target: dom.sheetClose, preventDefault() {} });
  await settle();
});

test('a toast while the show card is open is said inside the card', async () => {
  click({ action: 'driver', id: 'chihkan-tower' });
  assert.equal(dom.bigcard.hidden, false);
  const saved = globalThis.speechSynthesis;
  delete globalThis.speechSynthesis;
  try {
    dom.bigcard.listeners.click[0]({ target: dom.control({ action: 'big-say', say: '赤崁樓' }, {}, dom.bigcard), preventDefault() {} });
  } finally {
    if (saved) globalThis.speechSynthesis = saved;
  }
  assert.equal(cardStatus.textContent, tr('en', 'noSpeech'));
  dom.bigcard.listeners.click[0]({ target: dom.bigClose, preventDefault() {} });
  await settle();
});

test('the markup: a status region in the sheet panel, in the show card and in the page', () => {
  const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');
  const panel = html.slice(html.indexOf('class="sheet-panel"'), html.indexOf('id="bigcard"'));
  const region = /<div class="sr-status" role="status" aria-live="polite" aria-atomic="true"><\/div>/;
  assert.match(panel, region);
  assert.match(html, /<div id="announce" class="sr-status" role="status" aria-live="polite" aria-atomic="true"><\/div>/);
  assert.match(bigCardHtml('x', 'en'), region);
  for (const L of ['en', 'zh_TW']) {
    assert.ok(menuPromptSheet('p', true, L).includes(`<p class="small">${tr(L, 'copied')}</p>`), L);
    assert.ok(!menuPromptSheet('p', false, L).includes(tr(L, 'copied')), L);
  }
});
