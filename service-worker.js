const CACHE_NAME = 'truthponderer-v4';
const RUNTIME_CACHE = 'truthponderer-runtime-v4';

// Core assets that MUST be cached for offline functionality
const CORE_ASSETS = [
  '/truthPonderer/',
  '/truthPonderer/index.html',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=400&fit=crop'
];

// Install event - aggressively cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW v4] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW v4] Caching core assets...');
        // Cache each asset individually to see which ones fail
        return Promise.all(
          CORE_ASSETS.map(url => {
            return cache.add(url).then(() => {
              console.log('[SW v4] ✓ Cached:', url);
            }).catch(err => {
              console.error('[SW v4] ✗ Failed to cache:', url, err);
            });
          })
        );
      })
      .then(() => {
        console.log('[SW v4] All core assets processed');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW v4] Installation failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW v4] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name !== CACHE_NAME && name !== RUNTIME_CACHE;
            })
            .map((name) => {
              console.log('[SW v4] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW v4] Claiming clients...');
        return self.clients.claim();
      })
      .then(() => {
        console.log('[SW v4] Service Worker activated and ready!');
      })
  );
});

// Fetch event - Cache first, then network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // List of domains we want to cache
  const CACHEABLE_DOMAINS = [
    'satishticalai.github.io',
    'cdn.tailwindcss.com',
    'unpkg.com',
    'truthponderer.wordpress.com',
    'images.unsplash.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];

  // Check if this request is cacheable
  const isCacheable = CACHEABLE_DOMAINS.some(domain => 
    url.hostname.includes(domain)
  );

  if (!isCacheable) {
    // Don't handle non-cacheable domains
    return;
  }

  // Handle the request
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        
        // If we have a cached response, return it
        if (cachedResponse) {
          console.log('[SW v4] Cache HIT:', request.url);
          return cachedResponse;
        }

        // No cached response, try network
        console.log('[SW v4] Cache MISS, fetching:', request.url);
        
        return fetch(request).then((networkResponse) => {
          // Check if we got a valid response
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Clone the response before caching
          const responseToCache = networkResponse.clone();

          // Cache the new response
          caches.open(RUNTIME_CACHE).then((runtimeCache) => {
            runtimeCache.put(request, responseToCache);
            console.log('[SW v4] Cached new response:', request.url);
          });

          return networkResponse;
        }).catch((error) => {
          console.error('[SW v4] Fetch failed:', request.url, error);
          
          // If offline and requesting navigation, return cached index
          if (request.mode === 'navigate' || request.destination === 'document') {
            console.log('[SW v4] Returning cached index.html for navigation');
            
            return cache.match('/truthPonderer/index.html').then(indexResponse => {
              if (indexResponse) {
                return indexResponse;
              }
              
              return cache.match('/truthPonderer/').then(rootResponse => {
                if (rootResponse) {
                  return rootResponse;
                }
                
                // Last resort - return an error page
                return new Response(
                  `<!DOCTYPE html>
                  <html>
                  <head>
                    <title>truthPonderer - Offline</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body {
                        font-family: system-ui, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #065f46 0%, #047857 100%);
                        color: white;
                        text-align: center;
                        padding: 20px;
                      }
                      .container {
                        max-width: 500px;
                      }
                      h1 { font-size: 2rem; margin-bottom: 1rem; }
                      p { font-size: 1.1rem; margin-bottom: 1.5rem; }
                      button {
                        background: white;
                        color: #065f46;
                        border: none;
                        padding: 12px 24px;
                        font-size: 1rem;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                      }
                      button:hover { background: #f0f0f0; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h1>truthPonderer</h1>
                      <p>You're offline and the app hasn't been cached yet.</p>
                      <p>Please connect to the internet and visit the site first to enable offline access.</p>
                      <button onclick="location.reload()">Try Again</button>
                    </div>
                  </body>
                  </html>`,
                  {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'text/html' }
                  }
                );
              });
            });
          }

          // For non-navigation requests, check runtime cache
          return caches.open(RUNTIME_CACHE).then(runtimeCache => {
            return runtimeCache.match(request).then(runtimeResponse => {
              if (runtimeResponse) {
                console.log('[SW v4] Found in runtime cache:', request.url);
                return runtimeResponse;
              }
              
              // Nothing we can do, return error
              return new Response('Network error and not in cache', {
                status: 408,
                statusText: 'Request Timeout'
              });
            });
          });
        });
      });
    })
  );
});

// Message handler
self.addEventListener('message', (event) => {
  console.log('[SW v4] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      console.log('[SW v4] All caches cleared');
    });
  }
  
  if (event.data && event.data.type === 'CHECK_CACHE') {
    caches.open(CACHE_NAME).then(cache => {
      return cache.keys();
    }).then(keys => {
      console.log('[SW v4] Cached files:', keys.map(k => k.url));
    });
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW v4] Push received');
  
  const title = 'truthPonderer';
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: 'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
    badge: 'https://truthponderer.wordpress.com/wp-content/uploads/2018/08/tplogog.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v4] Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/truthPonderer/')
  );
});

console.log('[SW v4] Service Worker loaded');
