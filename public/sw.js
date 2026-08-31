const CACHE_NAME = 'metfa-social-v3';
const MEDIA_CACHE_NAME = 'metfa-media-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png',
  '/favicon-64.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-precomposed.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/playstore-icon-512.png',
  '/logo.png',
  '/logo.svg',
  '/metfa-emblem.png',
  '/metfa-emblem-128.png',
  '/metfa-emblem.svg',
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
  '/asset-manifest.json',
];

// Install Event - Resilient pre-caching of all essential shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        // Use allSettled so one transient missing asset never fails the entire SW install
        await Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
              console.warn('[SW] Pre-cache item skipped:', url, err?.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale legacy caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const allowedCaches = [CACHE_NAME, MEDIA_CACHE_NAME];
        return Promise.all(
          keys.map((key) => {
            if (!allowedCaches.includes(key)) {
              console.log('[SW] Deleting stale cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Skip Waiting trigger from client app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event - Network first for navigations, Stale-while-revalidate for assets, Cache-first for fonts
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension & internal browser schemes
  if (!request.url.startsWith('http')) {
    return;
  }

  // Strictly skip caching API endpoints, Vite modules, and TypeScript/JavaScript source modules
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  // Strategy 1: HTML Navigation (Network-First with offline fallback to cached SPA shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) return cachedShell;
          return caches.match('/');
        })
    );
    return;
  }

  // Strategy 2: Google Fonts (Cache-First with network fallback for offline typography)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Strategy 3: Media & External Avatar Images (Stale-While-Revalidate in MEDIA_CACHE)
  if (
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('dicebear.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('picsum.photos')
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 4: Local Static Assets (Network-first with cache fallback for images/icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});
