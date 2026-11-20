const CACHE = 'myfinance-v8';
const CORE = ['./', './index.html', './style.css', './script.js', './tailwind.css', './manifest.json', './icon-192.png', './icon-512.png', './fonts.css', './fontawesome.css', './fa-brands-400.woff2', './fa-regular-400.woff2', './fa-solid-900.woff2', './inter-latin-400-normal.woff2', './inter-latin-500-normal.woff2', './inter-latin-600-normal.woff2', './inter-latin-700-normal.woff2', './plus-jakarta-sans-latin-500-normal.woff2', './plus-jakarta-sans-latin-600-normal.woff2', './plus-jakarta-sans-latin-700-normal.woff2', './plus-jakarta-sans-latin-800-normal.woff2'];
self.addEventListener('install', e => {
  // Cache every app file up-front so the app opens with no internet at all.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never cache the Google Sheet sync calls.
  if (url.origin !== self.location.origin) return;
  // Network first (updates show immediately); fall back to the cache when offline.
  const req = new Request(e.request, { cache: 'no-store' });
  e.respondWith(
    fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html')))
  );
});
