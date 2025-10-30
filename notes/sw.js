// Простой заглушечный сервис-воркер; оживим кэш на шаге 4.
self.addEventListener('install', ()=>self.skipWaiting());
self.addEventListener('activate', e=>e.waitUntil(clients.claim()));
