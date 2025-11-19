const CACHE_NAME = 'debita-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/assets/icons/icon-48.png',
  '/assets/icons/icon-72.png',
  '/assets/icons/icon-96.png',
  '/assets/icons/icon-144.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-256.png',
  '/assets/icons/icon-384.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png'
];
self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  // Do not cache non-GET requests (avoid POST caching errors)
  if(req.method !== 'GET') return;
  ev.respondWith(caches.match(req).then(cached => cached || fetch(req).then(resp => {
    if(!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
    const copy = resp.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(req, copy).catch(()=>{}));
    return resp;
  }).catch(()=>caches.match('/index.html'))));
});