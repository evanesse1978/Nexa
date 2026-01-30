// File: sw.js
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installazione...');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Attivato');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Risponde con la rete. Serve solo per soddisfare il requisito PWA "offline capable"
  e.respondWith(fetch(e.request));
});