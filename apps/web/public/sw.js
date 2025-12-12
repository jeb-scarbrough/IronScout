// IronScout Service Worker
// This is a native service worker without third-party dependencies

const CACHE_NAME = 'ironscout-v1'
const OFFLINE_URL = '/offline.html'

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/favicon.svg',
]

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // Cache offline page and critical assets
      await cache.addAll(PRECACHE_ASSETS)
      // Activate immediately
      await self.skipWaiting()
    })()
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
      // Take control of all pages immediately
      await self.clients.claim()
    })()
  )
})

// Fetch event - network-first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return

  // Skip API requests from caching (let them fail naturally)
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.ironscout.ai') {
    return
  }

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(request)
        
        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME)
          // Clone the response before caching (response can only be consumed once)
          cache.put(request, networkResponse.clone())
        }
        
        return networkResponse
      } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request)
        
        if (cachedResponse) {
          return cachedResponse
        }

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL)
          if (offlineResponse) {
            return offlineResponse
          }
        }

        // For other requests, return a simple error response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        })
      }
    })()
  )
})

// Handle push notifications (ready for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || 'New notification from IronScout',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-96x96.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'IronScout', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }

      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })()
  )
})

// Background sync (ready for future use - e.g., retry failed alert creations)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlerts())
  }
})

async function syncAlerts() {
  // Future: Sync any pending alert creations when back online
  console.log('Background sync triggered')
}
