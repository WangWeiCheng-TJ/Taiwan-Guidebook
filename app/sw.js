// Service worker: precache everything on install, then stale-while-revalidate.
// The app opens instantly from cache (offline too) and picks up new files on the next open.
// When guidebook.json changes in the background, open pages get a 'data-updated' message.
// Bump CACHE when the SHELL list changes.

const CACHE = 'tg-v27';
const DATA = 'data/guidebook.json';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/main.js',
  'js/state.js',
  'js/util.js',
  'js/geo.js',
  'js/data.js',
  'js/storage.js',
  'js/triplog.js',
  'js/prompt.js',
  'js/ui.js',
  'js/types.js',
  'js/views/common.js',
  'js/views/explore.js',
  'js/views/place.js',
  'js/views/log.js',
  'js/views/ask.js',
  'js/views/reference.js',
  'js/views/trip.js',
  'js/views/food.js',
  'js/views/apps.js',
  'js/views/learn.js',
  'js/timeline.js',
  'js/trip.js',
  'js/aiplan.js',
  'js/i18n.js',
  'js/zhuyin.js',
  'js/lang.js',
  'js/phrases.js',
  'js/party.js',
  'js/topics.js',
  'js/nav.js',
  'js/bigcard.js',
  'js/stay.js',
  'js/views/stay.js',
  'js/backup.js',
  'js/asklater.js',
  DATA,
];

self.addEventListener('install', e => {
  // cache: 'reload' bypasses the HTTP cache, or a host's max-age could precache stale files
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Only our own old versions: Cache Storage is per origin, and on a shared host
  // (user.github.io/<repo>/) other sites' service workers keep their caches there too
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tg-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(staleWhileRevalidate(e));
});

async function staleWhileRevalidate(e) {
  const cache = await caches.open(CACHE);
  // One entry per path, query dropped: a ?trip= open must refresh the cached page, not store
  // a copy of it under its own URL that a later open could be served and nothing refreshes
  const url = new URL(e.request.url);
  url.search = '';
  const key = url.href;
  const isData = url.pathname.endsWith(DATA);
  const cached = await cache.match(key);

  const refresh = fetch(e.request, { cache: 'no-cache' }).then(async res => {
    if (res.ok) {
      if (isData && cached) {
        const [oldText, newText] = await Promise.all([cached.clone().text(), res.clone().text()]);
        await cache.put(key, res.clone());
        // awaited, so the message is sent inside waitUntil (the worker may stop once it settles)
        if (oldText !== newText) await notify();
      } else {
        await cache.put(key, res.clone());
      }
    }
    return res;
  });

  if (cached) {
    e.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  try {
    return await refresh;
  } catch {
    // Offline navigation to an uncached URL: fall back to the app shell
    return (e.request.mode === 'navigate' && (await cache.match('index.html'))) || Response.error();
  }
}

async function notify() {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const c of clients) c.postMessage({ type: 'data-updated' });
}
