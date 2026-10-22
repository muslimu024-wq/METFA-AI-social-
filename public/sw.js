const CACHE_NAME = 'metfa-social-v4';
const MEDIA_CACHE_NAME = 'metfa-media-v4';

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

// Fetch Event - Network first for navigations, Stale-while-revalidate for assets, Cache-first for fonts & CDN
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
            const contentType = networkResponse.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/index.html', copy);
              });
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) return cachedShell;
          const rootMatch = await caches.match('/');
          if (rootMatch) return rootMatch;
          return new Response('Application shell offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Strategy 2a: Google Fonts (Cache-First with network fallback for offline typography)
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

  // Strategy 2b: Tailwind CSS Runtime CDN (Cache-First with network fallback)
  if (url.hostname === 'cdn.tailwindcss.com') {
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

  // Strategy 4: Local Static Assets (Network-first with cache fallback, hardened against HTML pollution)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const pathname = url.pathname.toLowerCase();

            // CRITICAL GUARD: Never cache an HTML response as a JS, CSS, or asset bundle!
            const isAssetPath =
              pathname.startsWith('/assets/') ||
              pathname.endsWith('.js') ||
              pathname.endsWith('.css') ||
              pathname.endsWith('.png') ||
              pathname.endsWith('.svg') ||
              pathname.endsWith('.ico') ||
              pathname.endsWith('.woff2');

            if (isAssetPath && contentType.includes('text/html')) {
              console.warn('[SW] Rejected HTML response for static asset path:', url.pathname);
              return new Response('Asset Not Found', {
                status: 404,
                statusText: 'Not Found',
                headers: { 'Content-Type': 'text/plain' },
              });
            }

            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('Asset unavailable offline', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
  }
});
