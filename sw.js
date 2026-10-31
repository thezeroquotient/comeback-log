// Pocket Money shares this domain and its cache storage, so only comeback- caches are touched here.
// Offline support: the app opens with no internet once it has been opened online.
// The saved copy always loads first, so a weak gym signal can't stall it.
// Files update together, only when VERSION changes, so a page never runs against newer code.
// Bump VERSION on each release so phones pick it up on their next open.
const VERSION = 'comeback-v12';
const FILES = ['./', './index.html', './logic.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('comeback-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // the data service goes straight to the network
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const saved = await cache.match(e.request, { ignoreSearch: true });
      if (saved) return saved;
      // Another app on this domain can clear the cache, so they're all saved again when one is missing.
      try {
        const res = await fetch(e.request);
        if (res.ok) e.waitUntil(cache.addAll(FILES).catch(() => {}));
        return res;
      } catch {
        return cache.match('./index.html');
      }
    })
  );
});
