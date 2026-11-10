// Ask later when the app is opened online with items still waiting (copied offline in an earlier session): the Ask
// AI tab gets its dot at start, without the "Back online" toast, until the tab is shown. Own file: main.js starts
// once per process. Opened offline: main-asklater-open-offline.test.js; the rest of Ask later: main-asklater.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const KEY = 'tg.asklater.v1';
const dom = installDom({ hash: '#/explore', guidebook });
dom.store.set(KEY, JSON.stringify([
  { id: 'a', at: '2026-11-09T06:00:00.000Z', kind: 'explain', subject: '牌坊', where: 'Confucius Temple', prompt: 'a', waiting: true },
  { id: 'b', at: '2026-11-09T05:00:00.000Z', kind: 'near', subject: 'Where to eat?', where: 'Tainan City', prompt: 'b', waiting: true },
  { id: 'c', at: '2026-11-09T04:00:00.000Z', kind: 'near', subject: 'Night market?', where: 'Tainan City', prompt: 'c', waiting: false },
]));

const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

const askTab = () => dom.document.tabs.find(a => a.dataset.tab === 'ask');
const toastText = () => dom.document.getElementById('toast').textContent;
const go = async hash => { dom.location.hash = hash; await settle(); };

test('opened online on another tab with items copied offline: the dot, named for screen readers, and no toast', () => {
  assert.ok(askTab().classList.contains('has-dot'));
  assert.equal(askTab().getAttribute('aria-label'), tr('en', 'later.tabWaiting', { tab: 'Ask AI', n: 2 }), 'the two waiting');
  assert.equal(toastText(), '', 'no "Back online" toast: the phone was never offline in this session');
});

test('the dot stays on other pages and goes once the Ask AI tab is shown', async () => {
  await go('#/place/chihkan-tower');
  assert.ok(askTab().classList.contains('has-dot'));
  await go('#/ask');
  assert.equal(askTab().classList.contains('has-dot'), false);
  assert.equal(askTab().getAttribute('aria-label'), null);
  await go('#/explore');
  assert.equal(askTab().classList.contains('has-dot'), false, 'seen: it does not come back by itself');
});

test('a later "online" event still gives the toast and the dot', async () => {
  dom.fire('online');
  assert.equal(toastText(), tr('en', 'later.onlineN', { n: 2 }));
  assert.ok(askTab().classList.contains('has-dot'));
});
