// app/js/main.js asks the browser to keep the site's storage (navigator.storage.persist) after the first saved
// plan too, not only after a note; not when the storage is already kept, and never before anything is saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/log', guidebook });
let checks = 0;
let persistCalls = 0;
let kept = true;
navigator.storage = { persisted: async () => { checks++; return kept; }, persist: async () => { persistCalls++; return true; } };

const { state } = await import('../../app/js/state.js');
await import('../../app/js/main.js');
await settle();

const click = dataset => dom.view.listeners.click[0]({ target: dom.control(dataset), preventDefault() {} });
const plan = title => JSON.stringify({ title, days: [{ date: '2026-11-05', items: [{ place: 'chihkan-tower' }] }] });

test('nothing saved yet: the browser is not asked', () => {
  assert.equal(checks, 0);
  assert.equal(persistCalls, 0);
});

test('a pasted plan is the first save: the browser is asked once; already kept storage is not asked again', async () => {
  state.pasteText = plan('Plan A');
  click({ action: 'paste-plan' });
  await settle();
  assert.equal(state.trip?.title, 'Plan A');
  assert.equal(checks, 1, 'persisted() checked');
  assert.equal(persistCalls, 0, 'already kept: persist() not called');
  kept = false;
  state.pasteText = plan('Plan B');
  click({ action: 'paste-plan' });
  await settle();
  assert.equal(state.trip?.title, 'Plan B');
  assert.equal(checks, 1, 'once per page');
});
