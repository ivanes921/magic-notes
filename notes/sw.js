const CACHE_NAME = 'notes-shell-v2';
const ASSETS = [
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
self.addEventListener('fetch', (event)=>{
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put('./index.html', copy);
          });
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(res => res || fetch(event.request))
    );
  }
});
