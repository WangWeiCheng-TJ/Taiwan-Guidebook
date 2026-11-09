// The select-text "Ask AI" bar in app/js/main.js, driven in the fake browser (tests/fake-dom.js): the bar hides
// itself when tapped, so when its sheet closes focus goes back next to the selected text (a control around it,
// else the page's heading), not to <body> (review: keyboard and switch users started again from the top).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/place/chihkan-tower', guidebook });
navigator.clipboard = { writeText: async () => {} };
const h1 = new FakeElement(dom.document, { tag: 'h1', parent: dom.view });
dom.view.known.h1 = h1;
await import('../../app/js/main.js');
await settle();

const askbar = dom.document.getElementById('askbar');

/**
 * Select text inside `block` (in #view) and wait for the bar.
 * @param {FakeElement} block
 */
async function select(block) {
  const textNode = { nodeType: 3, parentElement: block };
  dom.document.getSelection = () => ({
    toString: () => 'Chihkan', anchorNode: textNode, containsNode: () => false, removeAllRanges() {},
  });
  dom.document.dispatch('selectionchange');
  await new Promise(r => setTimeout(r, 300)); // the bar waits for the selection to settle
  assert.equal(askbar.hidden, false, 'the bar shows');
}

/** Tap the focused bar, then close its sheet with Close. */
async function askThenClose() {
  askbar.focus();
  await askbar.listeners.click[0]();
  await settle();
  assert.equal(dom.sheet.hidden, false);
  assert.equal(askbar.hidden, true);
  dom.sheet.listeners.click[0]({ target: dom.sheetClose, preventDefault() {} });
  await settle();
  assert.equal(dom.sheet.hidden, true);
}

test('selected text in a paragraph: closing the sheet focuses the page heading', async () => {
  const p = new FakeElement(dom.document, { tag: 'p', parent: dom.view });
  p.textContent = 'Chihkan Tower was built by the Dutch.';
  await select(p);
  await askThenClose();
  assert.equal(dom.document.activeElement, h1);
  assert.equal(h1.getAttribute('tabindex'), '-1', 'a heading takes focus only with tabindex');
});

test('selected text inside a link: closing the sheet focuses that link', async () => {
  const card = new FakeElement(dom.document, { tag: 'a', parent: dom.view });
  const span = new FakeElement(dom.document, { tag: 'span', parent: card });
  span.closest = sel => (sel.startsWith('a[href]') ? card : null);
  await select(span);
  await askThenClose();
  assert.equal(dom.document.activeElement, card);
});
