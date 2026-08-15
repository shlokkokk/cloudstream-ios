const CACHE_NAME = 'cloudstream-ios-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
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

  // 3. Static asset cache with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
