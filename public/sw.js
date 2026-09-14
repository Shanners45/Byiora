// Byiora Service Worker v1
// Provides offline caching, runtime image caching, and offline fallback

const CACHE_VERSION = 'byiora-v1'
const OFFLINE_URL = '/offline.html'

// Assets to pre-cache on install (app shell)
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/icon.png',
  '/logo-final.png',
  '/manifest.json',
]

// Install: pre-cache the offline page and essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    })
  )
  // Take control of all pages immediately
  self.clients.claim()
})

// Fetch: network-first for pages, stale-while-revalidate for images/static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip Supabase, Sentry, analytics, and other API calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('sentry.io') ||
    url.hostname.includes('cloudflareinsights.com') ||
    url.hostname.includes('challenges.cloudflare.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/monitoring-tunnel')
  ) {
    return
  }

  // For navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful page loads for offline access
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => {
          // Try cache first, then offline fallback
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL)
          })
        })
    )
    return
  }

  // For product images from Supabase storage: stale-while-revalidate
  if (
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // For static assets (JS, CSS, fonts, local images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|avif|ico)$/) ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }
})
