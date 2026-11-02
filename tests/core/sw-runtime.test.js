// Runs app/sw.js against in-memory fakes of the service worker APIs (CacheStorage, clients, fetch),
// so the caching rules are checked without a browser. The fake Cache follows the spec where it
// matters here: put() replaces exact-URL matches and appends, match() returns the first hit in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(new URL('../../app/sw.js', import.meta.url), 'utf8');
const CACHE = SW_SOURCE.match(/const CACHE = '([^']+)'/)[1];
const SW_URL = 'https://example.test/app/sw.js';

const resolve = req => {
  const u = new URL(typeof req === 'string' ? req : req.url, SW_URL);
  u.hash = '';
  return u.href;
};
const withoutSearch = href => { const u = new URL(href); u.search = ''; return u.href; };

class FakeCache {
  constructor() { this.entries = []; }
  async match(req, opts = {}) {
    const url = resolve(req);
    const hit = this.entries.find(e => opts.ignoreSearch ? withoutSearch(e.url) === withoutSearch(url) : e.url === url);
    return hit ? hit.res.clone() : undefined;
  }
  async put(req, res) {
    const url = resolve(req);
    this.entries = this.entries.filter(e => e.url !== url);
    this.entries.push({ url, res: res.clone() });
  }
  async addAll(reqs) {
    const responses = await Promise.all(reqs.map(r => this.fetch(r)));
    responses.forEach((res, i) => {
      if (!res.ok) throw new TypeError(`addAll: ${reqs[i].url} answered ${res.status}`);
    });
    for (const [i, res] of responses.entries()) await this.put(reqs[i], res);
  }
  async keys() { return this.entries.map(e => ({ url: e.url })); }
}

/**
 * A fresh service worker global scope running app/sw.js, a fake static server and its clients.
 * `server.files` maps a path (no query) to the body served there; `server.offline` makes fetch fail.
 */
function boot() {
  const server = { files: new Map(), offline: false };
  const fetch = async req => {
    if (server.offline) throw new TypeError('Failed to fetch');
    const path = new URL(resolve(req)).pathname;
    return server.files.has(path)
      ? new Response(server.files.get(path), { status: 200 })
      : new Response('not found', { status: 404 });
  };
  const stores = new Map();
  const caches = {
    async open(name) {
      if (!stores.has(name)) { const c = new FakeCache(); c.fetch = fetch; stores.set(name, c); }
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const messages = [];
  const client = { postMessage: m => messages.push(m) };
  const handlers = {};
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      // Resolves on a later task, like the real one: work not covered by waitUntil can be cut off
      matchAll: () => new Promise(r => setTimeout(() => r([client]), 0)),
    },
  };
  class Request {
    constructor(input, init = {}) {
      this.url = resolve(input);
      this.method = init.method || input.method || 'GET';
      this.mode = input.mode || 'cors';
      this.cache = init.cache || 'default';
    }
  }
  const ctx = vm.createContext({ self, caches, fetch, Request, Response, URL, location: new URL(SW_URL), setTimeout, console });
  vm.runInContext(SW_SOURCE, ctx);

  /** Dispatch one event; resolves with the response (fetch events) once every waitUntil promise settled. */
  async function dispatch(type, fields = {}) {
    const pending = [];
    let response;
    const event = {
      ...fields,
      waitUntil: p => { pending.push(p); },
      respondWith: p => { response = p; pending.push(p); },
    };
    handlers[type](event);
    const res = response ? await response : undefined;
    for (let i = 0; i < pending.length; i++) await Promise.resolve(pending[i]).catch(() => {});
    return res;
  }

  const SHELL_BODY = 'shell';
  for (const path of [...SW_SOURCE.matchAll(/^\s+'([^']+)',$/gm)].map(m => m[1]))
    server.files.set(new URL(path, SW_URL).pathname, SHELL_BODY);
  server.files.set('/app/data/guidebook.json', '{"version":"1"}');

  return {
    server, stores, messages, dispatch,
    install: async () => { await dispatch('install'); await dispatch('activate'); },
    open: async (path, mode = 'navigate') => {
      const res = await dispatch('fetch', { request: { url: new URL(path, SW_URL).href, method: 'GET', mode } });
      return res.text();
    },
  };
}

test('opening a ?trip= link does not leave a stale copy of the app page in the cache', async () => {
  const sw = boot();
  sw.server.files.set('/app/', 'page v1');
  await sw.install();

  sw.server.files.set('/app/', 'page v2');
  assert.equal(await sw.open('/app/?trip=https%3A%2F%2Fexample.org%2Fplan.json'), 'page v1');
  sw.server.files.set('/app/', 'page v3');
  assert.equal(await sw.open('/app/'), 'page v2', 'serves what the last open fetched');
  sw.server.files.set('/app/', 'page v4');
  assert.equal(await sw.open('/app/'), 'page v3', 'serves what the last open fetched, not the ?trip= copy');

  const keys = (await sw.stores.get(CACHE).keys()).map(k => k.url);
  assert.deepEqual(keys.filter(k => new URL(k).search), [], 'no cache entry keyed by a query string');
});

test('offline, a ?trip= link still opens the cached app page', async () => {
  const sw = boot();
  sw.server.files.set('/app/', 'page v1');
  await sw.install();
  sw.server.offline = true;
  assert.equal(await sw.open('/app/?trip=https%3A%2F%2Fexample.org%2Fplan.json'), 'page v1');
  assert.equal(await sw.open('/app/data/guidebook.json', 'cors'), '{"version":"1"}');
});
