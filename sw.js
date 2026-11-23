const CACHE = 'myfinance-v9';
const CORE = ['./', './index.html', './style.css', './script.js', './manifest.json', './icon-192.png', './icon-512.png', './plus-jakarta-sans-latin-wght-normal.woff2', './fa-solid-900.woff2', './fa-regular-400.woff2', './fa-brands-400.woff2'];
self.addEventListener('install', e => {
  // Cache every app file up-front so the app opens instantly, even with no internet.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;   // Google Sheet sync is never cached
  // Cache first = opens instantly even on a weak signal. A new release ships a new cache name above.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
