const CACHE_NAME = 'cloudstream-ios-v2.5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Known ad networks, popunder scripts, and tracker domains
const AD_DOMAIN_PATTERNS = [
  'adsterra', 'popcash', 'monetag', 'admaven', 'propellerads',
  'highperformancegate', 'onclickads', 'bet365', '1xbet',
  'doubleclick.net', 'googlesyndication.com', 'histats.com',
  'juicyads', 'exoclick', 'adnxs', 'trafficjunky', 'outbrain',
  'taboola', 'adservice', 'popunder', 'clickadu'
];

self.addEventListener('fetch', (event) => {
  const url = event.request.url.toLowerCase();

  // 1. Drop and silence any ad network / popunder requests
  if (AD_DOMAIN_PATTERNS.some(domain => url.includes(domain))) {
    event.respondWith(new Response('', { status: 204, statusText: 'No Content' }));
    return;
  }

  // 2. Let API requests pass straight through to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // 3. Network-First strategy: Always fetch newest code from cloud, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
