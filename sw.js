// KARTOPIA service worker - enables offline play and "installable" PWA/APK.
const CACHE = 'kartopia-v1';
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
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Cache-first for our own assets; network-first fallback for the rest (CDN).
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // cache the three.js CDN module too, so it works offline next time
          if (req.url.includes('cdn.jsdelivr.net')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
