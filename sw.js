const CACHE_NAME = 'bujo-pro-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Playfair+Display:wght@600&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});