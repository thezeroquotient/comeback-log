// Offline support: the app opens with no internet once it has been opened online.
// The saved copy always loads first, so a weak gym signal can't stall it.
// Files update together, only when VERSION changes, so a page never runs against newer code.
// Bump VERSION on each release so phones pick it up on their next open.
const VERSION = 'comeback-v8';
const FILES = ['./', './index.html', './logic.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // the data service goes straight to the network
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(saved => saved || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
