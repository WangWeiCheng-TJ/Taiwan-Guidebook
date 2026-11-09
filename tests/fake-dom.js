// A minimal stand-in for the browser, enough to import app/js/main.js in Node and drive it through its event
// listeners (no dependencies, so no jsdom). Elements do not parse HTML: #view's innerHTML is a string the tests
// read, and querySelector only knows the few fixed elements of index.html registered below.
// History follows the browser's order on Back / Forward: popstate, then hashchange when the hash differs.

/** @typedef {{ type: string, target: FakeElement, key?: string, defaultPrevented: boolean, preventDefault(): void }} FakeEvent */

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  contains(c) { return this.set.has(c); }
  toggle(c, on = !this.set.has(c)) { if (on) this.set.add(c); else this.set.delete(c); return on; }
}

export class FakeElement {
  /**
   * @param {FakeDocument} doc
   * @param {{ id?: string, tag?: string, dataset?: Record<string, string>, parent?: FakeElement|null }} [opts]
   */
  constructor(doc, { id = '', tag = 'div', dataset = {}, parent = null } = {}) {
    this.doc = doc;
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.dataset = { ...dataset };
    this.parentElement = parent;
    this.attrs = new Map();
    this.listeners = {};
    /** @type {Record<string, FakeElement>} selector -> element, for querySelector */
    this.known = {};
    /** @type {Record<string, FakeElement[]>} selector -> elements, for querySelectorAll */
    this.knownAll = {};
    this.classList = new FakeClassList();
    this.innerHTML = '';
    this.textContent = '';
    this.hidden = false;
    this.inert = false;
    this.value = '';
    this.isConnected = true;
    this.scrollTop = 0;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  /** @returns {FakeEvent} */
  dispatch(type, props = {}) {
    const ev = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const fn of this.listeners[type] || []) fn(ev);
    return ev;
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === 'hidden') this.hidden = true; }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, on) {
    if (on) this.attrs.set(k, ''); else this.attrs.delete(k);
    if (k === 'inert') this.inert = !!on;
    return !!on;
  }
  querySelector(sel) { return this.known[sel] || null; }
  querySelectorAll(sel) { return this.knownAll[sel] || []; }
  contains(n) {
    for (let e = n; e; e = e.parentElement) if (e === this) return true;
    return false;
  }
  closest(sel) {
    if (sel === '[data-action]' && this.dataset.action) return this;
    return this.parentElement ? this.parentElement.closest(sel) : null;
  }
  matches() { return false; }
  focus() { this.doc.activeElement = this; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  click() { this.dispatch('click'); }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement(this, { tag: 'body' });
    this.documentElement = { lang: 'en' };
    this.activeElement = this.body;
    this.listeners = {};
    /** @type {Record<string, FakeElement>} */
    this.byId = {};
    /** @type {Record<string, FakeElement>} */
    this.bySelector = {};
    /** @type {FakeElement[]} */
    this.tabs = [];
  }
  getElementById(id) { return this.byId[id] || null; }
  querySelector(sel) { return this.bySelector[sel] || null; }
  querySelectorAll(sel) { return sel === '.tabbar a' ? this.tabs : []; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, props = {}) {
    const ev = { type, target: this.activeElement, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const fn of this.listeners[type] || []) fn(ev);
    return ev;
  }
  getSelection() { return null; }
  createElement(tag) { return new FakeElement(this, { tag }); }
}

/** Let queued timers and promise callbacks run (history traversal, fetch, file reads). */
export const settle = async (rounds = 5) => {
  for (let i = 0; i < rounds; i++) await new Promise(r => setTimeout(r, 0));
};

/**
 * Install the fake browser as globals. Call before importing app/js/main.js.
 * `stack`: history entries the tab already has (a reload), oldest first; the last one is current. Without it,
 * one entry at `hash` with no state.
 * @param {{ hash?: string, language?: string, guidebook?: unknown, fetchFails?: boolean,
 *   stack?: { hash: string, state: unknown }[] }} opts
 */
export function installDom({ hash = '#/explore', language = 'en-GB', guidebook = null, fetchFails = false, stack = null } = {}) {
  const document = new FakeDocument();
  const el = (id, opts = {}) => (document.byId[id] = new FakeElement(document, { id, ...opts }));

  el('brand', { tag: 'a' });
  el('net-status', { tag: 'span' }).hidden = true;
  el('lang-toggle', { tag: 'button' });
  const view = el('view', { tag: 'main' });
  const sheet = el('sheet');
  sheet.hidden = true;
  const sheetClose = new FakeElement(document, { tag: 'button', dataset: { action: 'close-sheet' }, parent: sheet });
  sheet.known['.sheet-head button'] = sheetClose;
  sheet.known['.sheet-title'] = new FakeElement(document, { tag: 'span', parent: sheet });
  sheet.known['.sheet-body'] = new FakeElement(document, { parent: sheet });
  const bigcard = el('bigcard');
  bigcard.hidden = true;
  const bigClose = new FakeElement(document, { tag: 'button', dataset: { action: 'close-big' }, parent: bigcard });
  el('askbar', { tag: 'button' }).hidden = true;
  el('toast');
  document.bySelector['.topbar'] = new FakeElement(document, { tag: 'header' });
  document.bySelector['.tabbar'] = new FakeElement(document, { tag: 'nav' });
  document.bySelector['#sheet .sheet-head button'] = sheetClose;
  document.bySelector['#bigcard .close'] = bigClose;
  document.tabs = ['explore', 'log', 'ask', 'phrases', 'tips'].map(tab => {
    const a = new FakeElement(document, { tag: 'a', dataset: { tab }, parent: document.bySelector['.tabbar'] });
    a.known['[data-label]'] = new FakeElement(document, { tag: 'span', parent: a });
    return a;
  });

  // ---------- window, history, location ----------
  const winListeners = {};
  const fireWin = type => { for (const fn of winListeners[type] || []) fn({ type }); };
  const base = 'http://localhost:8765/';
  const entries = (stack || [{ hash, state: null }]).map(e => ({ url: new URL(e.hash, base), state: structuredClone(e.state ?? null) }));
  let index = entries.length - 1;
  const cur = () => entries[index];

  const history = {
    scrollRestoration: 'auto',
    get state() { return structuredClone(cur().state); },
    get length() { return entries.length; },
    pushState(st, _title, url) {
      entries.splice(index + 1);
      entries.push({ url: url ? new URL(url, cur().url) : new URL(cur().url), state: structuredClone(st) });
      index++;
    },
    replaceState(st, _title, url) {
      entries[index] = { url: url ? new URL(url, cur().url) : cur().url, state: structuredClone(st) };
    },
    go(n) {
      setTimeout(() => {
        const to = index + n;
        if (to < 0 || to >= entries.length) return;
        const from = cur();
        index = to;
        fireWin('popstate');
        if (from.url.hash !== cur().url.hash) fireWin('hashchange');
      }, 0);
    },
    back() { this.go(-1); },
    forward() { this.go(1); },
  };

  const location = {
    get hash() { return cur().url.hash; },
    set hash(h) {
      const url = new URL(cur().url);
      url.hash = h;
      if (url.hash === cur().url.hash) return;
      entries.splice(index + 1);
      entries.push({ url, state: null });
      index++;
      setTimeout(() => fireWin('hashchange'), 0); // the browser queues it as a task
    },
    get search() { return cur().url.search; },
    get pathname() { return cur().url.pathname; },
    get href() { return cur().url.href; },
  };

  const window = {
    scrollY: 0,
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
    scrollTo(_x, y) { this.scrollY = y; },
  };

  // ---------- storage, network ----------
  const store = new Map();
  const storage = {
    failWrites: false,
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem(k, v) {
      if (storage.failWrites) throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: k => store.delete(k),
  };

  Object.assign(globalThis, {
    document, window, history, location, localStorage: storage,
    confirm: () => true,
    HTMLImageElement: class {},
    fetch: async () => {
      if (fetchFails) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => structuredClone(guidebook) };
    },
  });
  Object.defineProperty(globalThis, 'navigator', { value: { language, onLine: true }, configurable: true, writable: true });

  /**
   * An element inside #view (or another parent) carrying data-* attributes, as a view would render it.
   * @param {Record<string, string>} dataset
   * @param {Partial<FakeElement>} [props]
   * @param {FakeElement} [parent]
   */
  const control = (dataset, props = {}, parent = view) => Object.assign(new FakeElement(document, { tag: 'button', dataset, parent }), props);

  return { document, window, history, location, storage, view, sheet, bigcard, sheetClose, bigClose, control,
    entries: () => entries.length, at: () => index, store };
}
