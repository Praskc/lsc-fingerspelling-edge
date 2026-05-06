// ============================================================================
// SW.JS — Service Worker
// ============================================================================
const CACHE = 'yoso-v2'

const PRECACHE = [
  '/',
  '/YOSO.onnx',
  '/Centroides.json',
  '/favicon.svg',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        PRECACHE.map(url =>
          c.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      ))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
  )
  self.clients.claim()
})

function guardarEnCache(req, res) {
  // clone() debe llamarse sincrónicamente antes de cualquier await/then anidado
  const clone = res.clone()
  caches.open(CACHE).then(c => c.put(req, clone))
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // CDN externas: cache-first (URLs versionadas, inmutables)
  const esCDN = url.hostname.includes('cdn.jsdelivr.net') ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com')

  if (esCDN) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok || res.type === 'opaque') guardarEnCache(e.request, res)
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // Navegación HTML: network-first, fallback a caché
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          guardarEnCache(e.request, res)
          return res
        })
        .catch(() =>
          caches.match(e.request).then(c => c ?? caches.match('/'))
        )
    )
    return
  }

  // Todo lo demás (JS, CSS, modelo ONNX, WASM): cache-first, actualizar en fondo
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) guardarEnCache(e.request, res)
        return res
      })
      return cached ?? networkFetch
    })
  )
})
