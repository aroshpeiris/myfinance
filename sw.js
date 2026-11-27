const CACHE = 'myfinance-v11';
const CORE = ['./', './index.html', './style.css', './script.js', './manifest.json', './icon-192.png', './icon-512.png', './plus-jakarta-sans-latin-wght-normal.woff2', './fa-solid-900.woff2', './fa-regular-400.woff2', './fa-brands-400.woff2'];
self.addEventListener('install', e => {
  // Cache every app file up-front so the app opens instantly, even with no internet.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'myfinance-settings').map(k => caches.delete(k)))));
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

// ---- Reminders ----
async function remCheck() {
  const cache = await caches.open('myfinance-settings');
  const r = await cache.match('reminder-config');
  if (!r) return;
  const c = await r.json();
  if (!c.enabled) return;
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  c.fired = c.fired || {};
  let changed = false;
  for (const t of c.times) {
    if (t > hhmm || c.fired[t] === day) continue;
    c.fired[t] = day; changed = true;
    if (c.skip && c.entryDay === day) continue;
    await self.registration.showNotification('MyFinance reminder', { body: "Don't forget to add today's income and expenses.", icon: 'icon-192.png', badge: 'icon-192.png', tag: 'myfinance-reminder', data: { url: './index.html' } });
  }
  if (changed) await cache.put('reminder-config', new Response(JSON.stringify(c)));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'myfinance-reminder') e.waitUntil(remCheck()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './index.html');
  }));
});
