// The guide could not be loaded (first open while offline): the error screen and the chrome around it follow the
// UI language, and the language toggle works there too (audit ui #14). Own file: main.js starts once per process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';

const dom = installDom({ hash: '#/explore', language: 'zh-TW', fetchFails: true });
const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

const toggle = dom.document.getElementById('lang-toggle');

test('a zh-* browser gets the Chinese error, top bar and tabs', () => {
  assert.equal(dom.view.innerHTML, `<p>${tr('zh_TW', 'loadFail')}</p>`);
  assert.equal(dom.document.getElementById('brand').textContent, tr('zh_TW', 'brand'));
  assert.equal(dom.document.getElementById('net-status').textContent, tr('zh_TW', 'offline'));
  assert.equal(toggle.textContent, tr('zh_TW', 'switchTo'));
  assert.equal(dom.document.documentElement.lang, 'zh-Hant-TW');
  assert.deepEqual(dom.document.tabs.map(a => a.known['[data-label]'].textContent),
    ['explore', 'log', 'ask', 'phrases', 'tips'].map(t => tr('zh_TW', `tab.${t}`)));
});

test('the toggle switches the error screen and the chrome', () => {
  toggle.listeners.click[0]();
  assert.equal(dom.view.innerHTML, `<p>${tr('en', 'loadFail')}</p>`);
  assert.equal(dom.document.getElementById('brand').textContent, tr('en', 'brand'));
  assert.equal(toggle.textContent, tr('en', 'switchTo'));
  assert.equal(toggle.getAttribute('aria-label'), tr('en', 'switchLabel'));
  toggle.listeners.click[0]();
  assert.equal(dom.view.innerHTML, `<p>${tr('zh_TW', 'loadFail')}</p>`);
});

test('the "Loading…" line shown before the guide arrives is translated too', () => {
  assert.notEqual(tr('en', 'loading'), 'loading');
  assert.notEqual(tr('zh_TW', 'loading'), tr('en', 'loading'));
});

test('a route change on the error screen keeps the error (nothing to render without the guide)', async () => {
  dom.location.hash = '#/phrases';
  await settle();
  assert.equal(dom.view.innerHTML, `<p>${tr('zh_TW', 'loadFail')}</p>`);
});

test('the error screen counts as started: main.js marks #view and the boot watchdog in index.html stands down', () => {
  assert.equal(dom.view.hasAttribute('data-started'), true);
});
