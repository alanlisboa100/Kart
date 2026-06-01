// KARTOPIA service worker - offline play + installable PWA/APK.
// IMPORTANT: network-first for our own files so updates ALWAYS reach the player.
// (The previous cache-first version made people see an old build.)
const CACHE = 'kartopia-v21';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
  './src/main.js',
  './src/game.js',
  './src/kart.js',
  './src/track.js',
  './src/ai.js',
  './src/items.js',
  './src/audio.js',
  './src/input.js',
  './src/builders.js',
  './src/data.js',
  './src/fx.js',
  './src/progress.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting SW to take over immediately.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // NETWORK-FIRST for our own files: always try fresh, fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
  } else {
    // CACHE-FIRST for the CDN (three.js) so it loads instantly & works offline.
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (url.href.includes('cdn.jsdelivr.net')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
