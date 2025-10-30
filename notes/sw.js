const CACHE_NAME = 'notes-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/ios-180.png',
  '../shared/ui-ios.css'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))).then(()=>self.clients.claim())
  );
});

// Cache-first для статики
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request))
    );
  }
});
