const CACHE_NAME = 'notes-shell-v4';
const LAST_ROOM_KEY = './last-room';
const ASSETS = [
  './index.html',
  './app.js',
  './manifest.json',
  './icons/ios-180.png',
  '../shared/ui-ios.css'
];

async function setLastRoom(room){
  const cache = await caches.open(CACHE_NAME);
  if (room) {
    await cache.put(LAST_ROOM_KEY, new Response(room, { headers: { 'Content-Type': 'text/plain' } }));
  } else {
    await cache.delete(LAST_ROOM_KEY);
  }
}

async function getLastRoom(){
  const cache = await caches.open(CACHE_NAME);
  const res = await cache.match(LAST_ROOM_KEY);
  if (!res) return '';
  return (await res.text()).trim();
}

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

self.addEventListener('message', (event)=>{
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'notes:set-last-room') {
    const room = typeof data.room === 'string' ? data.room.toUpperCase() : '';
    event.waitUntil(setLastRoom(room));
    return;
  }

  if (data.type === 'notes:request-last-room') {
    event.waitUntil((async () => {
      const room = await getLastRoom();
      if (!room) return;
      const target = event.source;
      if (target && typeof target.postMessage === 'function') {
        target.postMessage({ type: 'notes:last-room', room });
      }
    })());
  }
});

// Cache-first для статики
self.addEventListener('fetch', (event)=>{
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      if (!url.searchParams.has('room') && url.searchParams.has('autojoin')) {
        const stored = await getLastRoom();
        if (stored) {
          const redirectUrl = new URL(url.toString());
          redirectUrl.searchParams.set('room', stored);
          redirectUrl.searchParams.delete('autojoin');
          return Response.redirect(redirectUrl.toString(), 302);
        }
      }

      try {
        const response = await fetch(event.request);
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put('./index.html', copy);
        });
        return response;
      } catch (err) {
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(res => res || fetch(event.request))
    );
  }
});
