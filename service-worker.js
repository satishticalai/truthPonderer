const CACHE_NAME = 'truthponderer-v2';
const DYNAMIC_CACHE = 'truthponderer-dynamic-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/truthPonderer/',
  '/truthPonderer/index.html',
  '/truthPonderer/manifest.json',
  'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
            .map((key) => {
              console.log('[Service Worker] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external domains except for our allowed CDNs
  const url = new URL(request.url);
  const allowedDomains = [
    'truthponderer.wordpress.com',
    'cdn.tailwindcss.com',
    'unpkg.com',
    'images.unsplash.com',
    'www.youtube.com',
    'i.ytimg.com'
  ];
  
  const isAllowedDomain = allowedDomains.some(domain => url.hostname.includes(domain));
  const isSameOrigin = url.origin === location.origin;
  
  if (!isSameOrigin && !isAllowedDomain) {
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log('[Service Worker] Serving from cache:', request.url);
          return response;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response
            const responseClone = response.clone();

            // Cache the fetched resource
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });

            return response;
          })
          .catch((error) => {
            console.log('[Service Worker] Fetch failed:', error);
            
            // Return cached index.html for navigation requests when offline
            if (request.mode === 'navigate') {
              return caches.match('/truthPonderer/index.html')
                .then(r => r || caches.match('/truthPonderer/'));
            }
            
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(
      Promise.resolve()
    );
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: 'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
    badge: 'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('truthPonderer', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/truthPonderer/')
  );
});
