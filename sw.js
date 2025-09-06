const CACHE_NAME = 'motion-recorder-v2';
const CACHE_VERSION = '2.0.0';

// Essential files that must be cached
const CRITICAL_RESOURCES = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './worker.js',
    './manifest.json'
];

// Optional resources that can fail without breaking the app
const OPTIONAL_RESOURCES = [
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/nanoid/4.0.0/nanoid.min.js'
];

// Network timeout in milliseconds
const NETWORK_TIMEOUT = 5000;

// Cache management
const MAX_CACHE_SIZE = 50; // Maximum number of cached requests
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Utility functions
const log = (message, data = '') => {
    console.log(`[SW v${CACHE_VERSION}] ${message}`, data);
};

const error = (message, err = '') => {
    console.error(`[SW v${CACHE_VERSION}] ${message}`, err);
};

// Enhanced cache management
const manageCache = async () => {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        if (requests.length > MAX_CACHE_SIZE) {
            // Remove oldest entries
            const entriesToRemove = requests.slice(0, requests.length - MAX_CACHE_SIZE);
            await Promise.all(entriesToRemove.map(request => cache.delete(request)));
            log(`Cleaned up ${entriesToRemove.length} old cache entries`);
        }
    } catch (err) {
        error('Cache management failed', err);
    }
};

// Network request with timeout
const fetchWithTimeout = (request, timeout = NETWORK_TIMEOUT) => {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), timeout)
        )
    ]);
};

// Install event with robust error handling
self.addEventListener('install', (event) => {
    log('Installing service worker');
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                
                // Cache critical resources first
                try {
                    await cache.addAll(CRITICAL_RESOURCES);
                    log('Critical resources cached successfully');
                } catch (err) {
                    error('Failed to cache critical resources', err);
                    throw err; // Critical failure
                }
                
                // Cache optional resources (don't fail if these don't work)
                for (const resource of OPTIONAL_RESOURCES) {
                    try {
                        const response = await fetchWithTimeout(resource);
                        if (response.ok) {
                            await cache.put(resource, response);
                            log(`Cached optional resource: ${resource}`);
                        }
                    } catch (err) {
                        log(`Failed to cache optional resource: ${resource}`, err.message);
                        // Continue without failing
                    }
                }
                
                // Force activation
                self.skipWaiting();
                
            } catch (err) {
                error('Installation failed', err);
                throw err;
            }
        })()
    );
});

// Activate event with cleanup
self.addEventListener('activate', (event) => {
    log('Activating service worker');
    
    event.waitUntil(
        (async () => {
            try {
                // Clean up old caches
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            log(`Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
                
                // Manage current cache size
                await manageCache();
                
                // Take control of all clients
                await self.clients.claim();
                
                log('Service worker activated successfully');
                
            } catch (err) {
                error('Activation failed', err);
            }
        })()
    );
});

// Enhanced fetch event with multiple strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Choose caching strategy based on request type
    if (isNavigationRequest(request)) {
        event.respondWith(handleNavigationRequest(request));
    } else if (isStaticAsset(request)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(request)) {
        event.respondWith(handleAPIRequest(request));
    } else {
        event.respondWith(handleGenericRequest(request));
    }
});

// Request type detection
const isNavigationRequest = (request) => {
    return request.mode === 'navigate';
};

const isStaticAsset = (request) => {
    const url = new URL(request.url);
    return /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i.test(url.pathname);
};

const isAPIRequest = (request) => {
    const url = new URL(request.url);
    return url.pathname.includes('/api/') || url.hostname !== location.hostname;
};

// Caching strategies
const handleNavigationRequest = async (request) => {
    try {
        // Network first for navigation
        const networkResponse = await fetchWithTimeout(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
    } catch (err) {
        log('Navigation network failed, trying cache', err.message);
        
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fall back to offline page
        const offlinePage = await caches.match('./index.html');
        if (offlinePage) {
            return offlinePage;
        }
        
        // Last resort: generate offline response
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Motion Recorder - Offline</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: #f5f5f5; 
                    }
                    .container { 
                        max-width: 400px; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 30px; 
                        border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                    }
                    .icon { font-size: 48px; margin-bottom: 20px; }
                    h1 { color: #6750A4; margin-bottom: 20px; }
                    p { color: #666; line-height: 1.5; }
                    button { 
                        background: #6750A4; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 20px; 
                        cursor: pointer; 
                        font-weight: 500; 
                        margin-top: 20px;
                    }
                    button:hover { background: #5a47a0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">📱</div>
                    <h1>You're Offline</h1>
                    <p>The Motion Recorder app is not available right now. Please check your internet connection and try again.</p>
                    <button onclick="window.location.reload()">Try Again</button>
                </div>
            </body>
            </html>
        `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }
};

const handleStaticAsset = async (request) => {
    try {
        // Cache first for static assets
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // Check if cache is fresh
            const cacheDate = cachedResponse.headers.get('date');
            if (cacheDate && (Date.now() - new Date(cacheDate).getTime()) < CACHE_EXPIRY) {
                return cachedResponse;
            }
        }
        
        // Try network
        const networkResponse = await fetchWithTimeout(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        // Fall back to cache even if stale
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw new Error('No cached version available');
        
    } catch (err) {
        log(`Static asset failed: ${request.url}`, err.message);
        
        // Return cached version if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Generate fallback response for critical assets
        if (request.url.includes('.css')) {
            return new Response('/* Fallback CSS - offline */', {
                status: 200,
                headers: { 'Content-Type': 'text/css' }
            });
        }
        
        if (request.url.includes('.js')) {
            return new Response('// Fallback JS - offline\nconsole.log("Service worker: Offline fallback");', {
                status: 200,
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
};

const handleAPIRequest = async (request) => {
    try {
        // Network only for API requests
        return await fetchWithTimeout(request, 10000); // Longer timeout for API
    } catch (err) {
        log(`API request failed: ${request.url}`, err.message);
        
        // Return appropriate offline response
        return new Response(JSON.stringify({
            error: 'Service unavailable',
            message: 'This feature requires an internet connection',
            offline: true,
            timestamp: new Date().toISOString()
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

const handleGenericRequest = async (request) => {
    try {
        // Try network first
        const networkResponse = await fetchWithTimeout(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
    } catch (err) {
        log(`Generic request failed, trying cache: ${request.url}`, err.message);
        
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return generic offline response
        return new Response('Content not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
};

// Background sync for data upload when connection restored
self.addEventListener('sync', (event) => {
    log(`Background sync triggered: ${event.tag}`);
    
    if (event.tag === 'upload-pending-data') {
        event.waitUntil(uploadPendingData());
    } else if (event.tag === 'cache-cleanup') {
        event.waitUntil(manageCache());
    }
});

const uploadPendingData = async () => {
    try {
        log('Attempting to upload pending data');
        
        // This would integrate with the main app's IndexedDB
        // to find and upload any pending recordings
        const clients = await self.clients.matchAll();
        
        for (const client of clients) {
            client.postMessage({
                type: 'SYNC_UPLOAD_REQUESTED',
                timestamp: Date.now()
            });
        }
        
        log('Upload sync message sent to clients');
        
    } catch (err) {
        error('Background upload failed', err);
    }
};

// Handle push notifications (for future features)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        log('Push notification received', data);
        
        const options = {
            body: data.body || 'New update available',
            icon: './icon-192.png',
            badge: './icon-96.png',
            vibrate: [200, 100, 200],
            data: data.data || {},
            actions: [
                {
                    action: 'open',
                    title: 'Open App'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Motion Recorder', options)
        );
        
    } catch (err) {
        error('Push notification handling failed', err);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    log('Notification clicked', event.action);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});

// Periodic background tasks
self.addEventListener('periodicsync', (event) => {
    log(`Periodic sync: ${event.tag}`);
    
    if (event.tag === 'cache-maintenance') {
        event.waitUntil(manageCache());
    }
});

// Handle client communication
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_UPDATE':
            event.waitUntil(updateCache(data));
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(clearCache());
            break;
            
        case 'GET_CACHE_STATUS':
            event.waitUntil(getCacheStatus().then(status => {
                event.ports[0].postMessage(status);
            }));
            break;
            
        default:
            log(`Unknown message type: ${type}`);
    }
});

const updateCache = async (urls = []) => {
    try {
        const cache = await caches.open(CACHE_NAME);
        
        for (const url of urls) {
            try {
                const response = await fetchWithTimeout(url);
                if (response.ok) {
                    await cache.put(url, response);
                    log(`Updated cache for: ${url}`);
                }
            } catch (err) {
                log(`Failed to update cache for: ${url}`, err.message);
            }
        }
    } catch (err) {
        error('Cache update failed', err);
    }
};

const clearCache = async () => {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        log('All caches cleared');
    } catch (err) {
        error('Cache clearing failed', err);
    }
};

const getCacheStatus = async () => {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        const status = {
            version: CACHE_VERSION,
            cacheSize: requests.length,
            cachedUrls: requests.map(req => req.url),
            lastUpdated: new Date().toISOString()
        };
        
        return status;
    } catch (err) {
        error('Failed to get cache status', err);
        return { error: err.message };
    }
};

// Error boundary for unhandled errors
self.addEventListener('error', (event) => {
    error('Service worker error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    error('Service worker unhandled rejection', event.reason);
    event.preventDefault();
});

log('Service worker script loaded successfully');
