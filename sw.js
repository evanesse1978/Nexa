/* NEXA CRM - Service Worker con supporto cache offline */

const CACHE_VERSION = 'nexa-crm-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './nexa-manifest.webmanifest',
  './nexa-icon.svg',
  './nexa-192.png',
  './nexa-512.png'
];

const STATIC_CDN_HOSTS = [
  'www.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.tailwindcss.com'
];

/* INSTALLAZIONE E CACHE DEI FILE PRINCIPALI */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    for (const file of APP_SHELL) {
      try {
        const response = await fetch(file, { cache: 'reload' });

        if (response.ok) {
          await cache.put(file, response);
        }
      } catch (error) {
        // Continua anche se un file non è disponibile.
      }
    }

    await self.skipWaiting();
  })());
});

/* ATTIVAZIONE E PULIZIA DELLE VECCHIE CACHE */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter((name) =>
          name.startsWith('nexa-crm-') &&
          name !== CACHE_VERSION
        )
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

/* RICHIESTE INTERNE: RETE PRIMA, CACHE COME RISERVA */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const appPage = await cache.match('./index.html');

    if (appPage) {
      return appPage;
    }

    return new Response(
      'NEXA CRM non è disponibile offline. Apri l’app con Internet e riprova.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }
    );
  }
}

/* LIBRERIE STATICHE ESTERNE: CACHE PRIMA, RETE COME RISERVA */
async function staticCdnFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          return cache.put(request, response.clone());
        }
      })
      .catch(() => {});

    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return new Response(
      'Libreria non disponibile offline.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }
    );
  }
}

/* GESTIONE DELLE RICHIESTE */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Non intercettare richieste che modificano dati.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // File ospitati sullo stesso sito NEXA.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Memorizza solo le librerie statiche indicate.
  // Le API Firebase non vengono intercettate.
  if (STATIC_CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staticCdnFirst(request));
  }
});
