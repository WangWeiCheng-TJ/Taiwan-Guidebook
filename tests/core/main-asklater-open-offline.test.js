// Ask later when the app is opened offline with items waiting: no dot at start (there is nothing to ask yet); the
// 'online' event brings the toast and the dot. Own file: main.js starts once per process. Opened online:
// main-asklater-open.test.js (another tab) and main-asklater.test.js (the Ask AI tab).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const KEY = 'tg.asklater.v1';
const dom = installDom({ hash: '#/explore', guidebook });
navigator.onLine = false;
dom.store.set(KEY, JSON.stringify([
  { id: 'a', at: '2026-11-09T06:00:00.000Z', kind: 'explain', subject: '牌坊', where: 'Confucius Temple', prompt: 'a', waiting: true },
]));

const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

const askTab = () => dom.document.tabs.find(a => a.dataset.tab === 'ask');
const toastText = () => dom.document.getElementById('toast').textContent;

test('opened offline with an item copied offline: no dot and no toast', () => {
  assert.equal(askTab().classList.contains('has-dot'), false);
  assert.equal(askTab().getAttribute('aria-label'), null);
  assert.equal(toastText(), '');
});

test('then back online: the toast and the dot', () => {
  navigator.onLine = true;
  dom.fire('online');
  assert.equal(toastText(), tr('en', 'later.online1'));
  assert.ok(askTab().classList.contains('has-dot'));
  assert.equal(askTab().getAttribute('aria-label'), tr('en', 'later.tabWaiting', { tab: 'Ask AI', n: 1 }));
});
