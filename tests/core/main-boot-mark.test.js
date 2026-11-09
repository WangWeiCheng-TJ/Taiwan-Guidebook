// main.js and the boot watchdog in index.html (boot-watchdog.test.js): while the guide loads, #view shows a loading
// line the watchdog recognises (data-loading); the first render marks #view data-started so the watchdog stands
// down. Own file: main.js starts once per process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/explore', language: 'zh-TW', guidebook });
// Hold the guide back until the second test: the "Loading…" state can then be looked at
const loaded = globalThis.fetch;
/** @type {() => void} */
let release = () => {};
const gate = new Promise(r => { release = r; });
globalThis.fetch = async (...args) => { await gate; return loaded(...args); };

const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

test('while the guide loads: the loading line, in the UI language, carries data-loading; #view is not marked', () => {
  assert.equal(dom.view.innerHTML, `<p class="muted" data-loading>${tr('zh_TW', 'loading')}</p>`);
  assert.equal(dom.view.hasAttribute('data-started'), false);
});

test('a route change while loading leaves the loading line for the watchdog', async () => {
  dom.location.hash = '#/phrases';
  await settle();
  assert.match(dom.view.innerHTML, /data-loading/);
  assert.equal(dom.view.hasAttribute('data-started'), false);
});

test('the first render marks #view data-started (the watchdog stands down)', async () => {
  release();
  await settle();
  assert.doesNotMatch(dom.view.innerHTML, /data-loading/);
  assert.equal(dom.view.hasAttribute('data-started'), true);
});
