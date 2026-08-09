const VERSION = '1'

const CACHES = {
  shell: `mia-shell-${VERSION}`,
  static: `mia-static-${VERSION}`,
  api: `mia-api-${VERSION}`,
}

const SHELL_PRECACHE = ['/driver/login', '/manifest.webmanifest', '/driver-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHES.shell)
      .then((cache) => cache.addAll(SHELL_PRECACHE))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !Object.values(CACHES).includes(key))
            .map((key) => caches.delete(key))
        )
      )
  )
})

function isCacheable(response, expectedPath) {
  if (!response || !response.ok || response.status !== 200) return false
  if (response.headers.get('set-cookie')) return false
  if (expectedPath && new URL(response.url).pathname !== expectedPath) return false
  return true
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHES.shell)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) {
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHES.static)
  const cached = await cache.match(request)
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response)
      })
      .catch(() => {})
    return cached
  }
  const response = await fetch(request)
  if (isCacheable(response)) {
    cache.put(request, response.clone())
  }
  return response
}

async function apiFetch(request) {
  const cache = await caches.open(CACHES.api)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    return
  }

  if (url.pathname.startsWith('/api/driver/')) {
    event.respondWith(apiFetch(request))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  event.respondWith(cacheFirst(request))
})
