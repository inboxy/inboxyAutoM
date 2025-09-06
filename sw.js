const CACHE_NAME = 'motion-recorder-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './worker.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/nanoid/4.0.0/nanoid.min.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Cache opened');
            return cache.addAll(urlsToCache).catch((error) => {
                console.error('Cache addAll failed:', error);
                // Continue even if some resources fail to cache
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }
            
            // Clone the request
            const fetchRequest = event.request.clone();
            
            return fetch(fetchRequest).then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                // Clone the response
                const responseToCache = response.clone();
                
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                
                return response;
            }).catch((error) => {
                console.error('Fetch failed:', error);
                // Return a fallback response for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Network error occurred', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});

// Handle background sync (if needed in the future)
self.addEventListener('sync', (event) => {
    if (event.tag === 'upload-data') {
        event.waitUntil(uploadPendingData());
    }
});

function uploadPendingData() {
    // This function could be used to upload data when connection is restored
    console.log('Background sync triggered');
    return Promise.resolve();
}
