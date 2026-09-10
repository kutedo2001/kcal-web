/* Service worker: cachea la app para que abra sin conexión.
   Sube CACHE cuando cambies algún archivo para forzar la actualización. */
const CACHE = 'balanc-v3';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './foods.js', './planner.js', './ocr.js', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Las llamadas a Open Food Facts siempre van a la red
  if (url.hostname.includes('openfoodfacts') || url.hostname.includes('jsdelivr')) return;
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
