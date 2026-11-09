// The boot watchdog in app/index.html: a classic inline script that offers Repair when the app does not start
// (a module that fails to load or throws, or #view still on "Loading…" 8 seconds on). It is run here in a node:vm
// sandbox with a small fake of the few browser objects it touches; main.js's side (data-loading, data-started) is
// in main-boot-mark.test.js and main-loadfail.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { tr, LANG_KEY } from '../../app/js/lang.js';

const read = path => readFileSync(new URL(`../../app/${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const script = scriptMatch ? scriptMatch[1] : '';

const LOADING = '<p class="muted" data-loading>Loading…</p>';

// ---------- The script and the page it watches ----------

test('index.html has the watchdog as a classic inline script, before the app module', () => {
  assert.ok(scriptMatch, 'an inline <script> without type="module"');
  const module = html.indexOf('<script type="module" src="js/main.js">');
  assert.ok(module > 0, 'main.js is still loaded as a module');
  assert.ok(scriptMatch.index < module, 'listening before main.js can fail');
  // It must run where modules do not: no module-only or newer syntax
  assert.doesNotMatch(script, /\bimport\b|\bexport\b|=>|\blet\b|\bconst\b|`|\?\.|\?\?|\basync\b|\bawait\b/);
});

test('it references the right ids, attributes, storage key and cache prefix', () => {
  for (const id of ['view', 'announce']) {
    assert.ok(script.includes(`getElementById('${id}')`), `reads #${id}`);
    assert.match(html, new RegExp(`<[a-z]+ id="${id}"`), `#${id} is in the page`);
  }
  assert.ok(script.includes('id="boot-repair"') && script.includes("getElementById('boot-repair')"), 'its own button');
  assert.ok(script.includes("'[data-loading]'"), 'looks for the loading line');
  assert.ok(script.includes("'data-started'"), 'stands down on main.js\'s mark');
  assert.ok(script.includes(`'${LANG_KEY}'`), 'the saved language');
  assert.ok(script.includes("indexOf('tg-') === 0"), 'only the app\'s own caches');
  assert.match(read('sw.js'), /const CACHE = 'tg-v\d+';/, 'the service worker\'s caches are tg-*');
  assert.ok(script.includes("'error'") && script.includes("'unhandledrejection'"));
  assert.ok(script.includes('8000'), 'about 8 seconds');
});

test('the loading line in #view and the one main.js writes both carry data-loading; main.js marks data-started', () => {
  assert.match(html, /<main id="view"[^>]*>\s*<p class="muted" data-loading>Loading…<\/p>\s*<\/main>/);
  const main = read('js/main.js');
  assert.ok(main.includes('<p class="muted" data-loading>${tr(state.lang, \'loading\')}</p>'));
  assert.ok(main.includes("view.setAttribute('data-started', '')"));
});

test('its two strings are lang.js\'s bootFail and bootRepair, in both languages', () => {
  for (const L of ['en', 'zh_TW']) {
    for (const key of ['bootFail', 'bootRepair']) {
      assert.notEqual(tr(L, key), key, `${L} ${key}`);
      const quoted = JSON.stringify(tr(L, key)).slice(1, -1);
      assert.ok(script.includes(`'${quoted}'`) || script.includes(`"${quoted}"`), `${L} ${key} in index.html`);
    }
  }
  assert.notEqual(tr('zh_TW', 'bootFail'), tr('en', 'bootFail'));
});

// ---------- Behaviour, in a sandbox ----------

/**
 * Run the watchdog against a fake page whose #view shows the loading line.
 * @param {{ stored?: string|null, language?: string, storageThrows?: boolean, sw?: boolean, caches?: boolean,
 *   failing?: boolean }} [opts]  failing: unregister and caches.keys reject
 */
function boot({ stored = null, language = 'en-GB', storageThrows = false, sw = true, caches = true, failing = false } = {}) {
  /** @type {{ fn: Function, ms: number }[]} */
  let timers = [];
  /** @type {Record<string, Function[]>} */
  const listeners = {};
  const log = { unregistered: 0, deleted: /** @type {string[]} */ ([]), reloads: 0 };
  let button = null;
  const makeButton = () => {
    const b = { disabled: false, listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); } };
    return b;
  };
  const view = {
    html: LOADING,
    attrs: new Set(),
    get innerHTML() { return this.html; },
    set innerHTML(v) { this.html = v; button = v.includes('id="boot-repair"') ? makeButton() : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    setAttribute(k) { this.attrs.add(k); },
    querySelector(sel) {
      assert.equal(sel, '[data-loading]');
      return /<[a-z]+[^>]*\sdata-loading[\s>=]/.test(this.html) ? {} : null;
    },
  };
  const announce = { textContent: '' };
  const ctx = {
    document: {
      getElementById: id => ({ view, announce, 'boot-repair': button })[id] || null,
    },
    navigator: {
      language,
      serviceWorker: sw ? {
        getRegistration: async () => ({
          unregister: async () => { if (failing) throw new Error('no'); log.unregistered++; return true; },
        }),
      } : undefined,
    },
    localStorage: {
      getItem: k => {
        if (storageThrows) throw new Error('SecurityError');
        return k === LANG_KEY ? stored : null;
      },
    },
    location: { reload: () => { log.reloads++; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
    addEventListener: (type, fn, capture) => { (listeners[type] ||= []).push(fn); if (type === 'error') assert.equal(capture, true); },
  };
  if (caches) {
    ctx.caches = {
      keys: async () => { if (failing) throw new Error('no'); return ['tg-v27', 'tg-v26', 'other-app-v1']; },
      delete: async k => { log.deleted.push(k); return true; },
    };
  }
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return {
    view, announce, log,
    /** The window as the script sees it: the target of a thrown error's ErrorEvent. */
    win: vm.runInContext('window', ctx),
    button: () => button,
    /** The timers set so far. */
    timers: () => timers,
    /** Let the pending timers fire (time passes by their delay). */
    elapse() { const due = timers; timers = []; for (const t of due) t.fn(); },
    fire(type, event) { for (const fn of listeners[type] || []) fn(event); },
    /** main.js rendered a page and marked it */
    appRenders(page = '<h1>Explore</h1>') { view.html = page; view.attrs.add('data-started'); },
  };
}

const flush = () => new Promise(r => setImmediate(r));
const message = L => `<div lang="${L === 'zh_TW' ? 'zh-Hant-TW' : 'en'}"><p>${tr(L, 'bootFail')}</p>`
  + `<button type="button" class="btn primary" id="boot-repair">${tr(L, 'bootRepair')}</button></div>`;

test('nothing happens at once: the loading line stays and one check is set for 8 seconds on', () => {
  const b = boot();
  assert.equal(b.view.innerHTML, LOADING);
  assert.deepEqual(b.timers().map(t => t.ms), [8000]);
});

test('still loading 8 seconds on: the message and Repair replace the loading line; screen readers hear it', () => {
  const b = boot();
  b.elapse();
  assert.equal(b.view.innerHTML, message('en'));
  assert.equal(b.announce.textContent, tr('en', 'bootFail'));
  assert.ok(b.button(), 'Repair is wired');
  assert.equal(b.button().listeners.click.length, 1);
});

test('language: the saved choice, else Chinese for a zh-* browser, else English; storage that throws is no choice', () => {
  const lang = opts => { const b = boot(opts); b.elapse(); return b.view.innerHTML; };
  assert.equal(lang({ language: 'zh-TW' }), message('zh_TW'));
  assert.equal(lang({ language: 'zh-HK' }), message('zh_TW'));
  assert.equal(lang({ language: 'de-DE' }), message('en'));
  assert.equal(lang({ stored: '"zh_TW"', language: 'en-US' }), message('zh_TW'));
  assert.equal(lang({ stored: '"en"', language: 'zh-TW' }), message('en'));
  assert.equal(lang({ stored: 'not json', language: 'zh-TW' }), message('zh_TW'));
  assert.equal(lang({ stored: '"fr"', language: 'en' }), message('en'));
  assert.equal(lang({ storageThrows: true, language: 'zh-TW' }), message('zh_TW'));
});

test('the app started in time: its page stays and the watchdog stops looking', () => {
  const b = boot();
  b.appRenders();
  b.elapse();
  assert.equal(b.view.innerHTML, '<h1>Explore</h1>');
  assert.deepEqual(b.timers(), [], 'no further checks');
});

test('a script that fails to load or throws, or an uncaught rejection, before the app started: the message at once', () => {
  for (const [type, event] of [
    ['error', { target: { tagName: 'SCRIPT' } }], // a module (or one it imports) failed to load
    ['error', null], // the ErrorEvent of a script that threw: its target is the window (b.win)
    ['unhandledrejection', {}],
  ]) {
    const b = boot();
    b.fire(type, event || { target: b.win });
    assert.equal(b.view.innerHTML, message('en'), type);
  }
});

test('a broken image or stylesheet is no failed start', () => {
  const b = boot();
  b.fire('error', { target: { tagName: 'IMG' } });
  b.fire('error', { target: { tagName: 'LINK' } });
  assert.equal(b.view.innerHTML, LOADING);
});

test('once the app has started, errors leave its page alone', () => {
  const b = boot();
  b.appRenders('<h1>Phrases</h1>');
  b.fire('error', { target: b.win });
  b.fire('error', { target: { tagName: 'SCRIPT' } });
  b.fire('unhandledrejection', {});
  assert.equal(b.view.innerHTML, '<h1>Phrases</h1>');
});

test('a second error while the message is up changes nothing (Repair keeps its listener)', () => {
  const b = boot();
  b.fire('unhandledrejection', {});
  const first = b.button();
  b.fire('error', { target: b.win });
  assert.equal(b.button(), first);
  assert.equal(b.view.innerHTML, message('en'));
});

test('a slow first load is not cut off: loading goes on under the message and the app replaces it', () => {
  const b = boot();
  b.elapse(); // 8 s: main.js has not even run yet
  assert.equal(b.view.innerHTML, message('en'));
  assert.equal(b.timers().length, 1, 'keeps looking');
  b.view.innerHTML = '<p class="muted" data-loading>載入中…</p>'; // main.js starts: its own loading line
  b.elapse(); // 16 s: the guide is still on its way
  assert.equal(b.view.innerHTML, message('en'), 'the message is back');
  b.appRenders(); // the guide arrives
  assert.equal(b.view.innerHTML, '<h1>Explore</h1>');
  b.elapse();
  assert.equal(b.view.innerHTML, '<h1>Explore</h1>');
  assert.deepEqual(b.timers(), [], 'stood down');
});

test('an older main.js that does not mark #view: once its page is up the watchdog leaves it and stops', () => {
  const b = boot();
  b.view.innerHTML = '<p class="muted">Loading…</p>'; // no data-loading: an app that predates the watchdog
  b.elapse();
  assert.equal(b.view.innerHTML, '<p class="muted">Loading…</p>');
  assert.deepEqual(b.timers(), []);
});

test('Repair: unregisters this page\'s service worker, deletes only the tg- caches, then reloads', async () => {
  const b = boot();
  b.elapse();
  const button = b.button();
  button.listeners.click[0]();
  assert.equal(button.disabled, true, 'one tap is enough');
  assert.equal(b.log.reloads, 0, 'not before the clean-up');
  await flush();
  assert.equal(b.log.unregistered, 1);
  assert.deepEqual(b.log.deleted, ['tg-v27', 'tg-v26'], 'other sites\' caches on a shared host stay');
  assert.equal(b.log.reloads, 1);
});

test('Repair still reloads without a service worker or Cache Storage, or when the clean-up fails', async () => {
  for (const opts of [{ sw: false, caches: false }, { failing: true }]) {
    const b = boot(opts);
    b.elapse();
    b.button().listeners.click[0]();
    await flush();
    assert.equal(b.log.reloads, 1, JSON.stringify(opts));
    assert.equal(b.log.unregistered, 0);
  }
});
