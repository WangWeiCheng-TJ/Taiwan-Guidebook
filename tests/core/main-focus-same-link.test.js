// Back gives focus to the link the reader used, also when the page has several links to the same place
// (app/js/main.js in the fake browser, tests/fake-dom.js). My trip links to a place from the plan and from a
// note; Back used to focus the first of them (review: focus landed on the plan's stop, not the note).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/log', guidebook });
await import('../../app/js/main.js');
await settle();

/** A link inside #view as My trip renders it. */
const link = href => {
  const a = new FakeElement(dom.document, { tag: 'a', parent: dom.view });
  a.setAttribute('href', href);
  return a;
};

test('Back focuses the note\'s link again, not the plan\'s link to the same place above it', async () => {
  const sel = '[href="#/place/chihkan-tower"]';
  const planStop = link('#/place/chihkan-tower');
  const note = link('#/place/chihkan-tower');
  dom.view.known[sel] = planStop; // querySelector: the first match
  dom.view.knownAll[sel] = [planStop, note];

  note.focus();
  dom.location.hash = '#/place/chihkan-tower'; // the reader follows the note's link
  await settle();
  assert.notEqual(dom.document.activeElement, note);
  dom.history.back();
  await settle();
  assert.equal(dom.location.hash, '#/log');
  assert.equal(dom.document.activeElement, note);
});

test('when fewer links match after the page changed, the first one gets focus', async () => {
  const sel = '[href="#/place/anping-old-fort"]';
  const first = link('#/place/anping-old-fort');
  const second = link('#/place/anping-old-fort');
  dom.view.known[sel] = first;
  dom.view.knownAll[sel] = [first, second];
  second.focus();
  dom.location.hash = '#/tips';
  await settle();
  dom.view.knownAll[sel] = [first]; // e.g. the second note was deleted meanwhile
  dom.history.back();
  await settle();
  assert.equal(dom.document.activeElement, first);
});
