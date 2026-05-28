// ============================================================================
// SW.JS — Service Worker YOSO (offline-first, cache-first para assets)
// ============================================================================
const CACHE = 'yoso-v6'

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
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .catch(() => {})
  )
  self.clients.claim()
})

function guardarEnCache(req, res) {
  const clone = res.clone()
  caches.open(CACHE)
    .then(c => c.put(req, clone))
    .catch(() => {})
}

function safeMatch(req) {
  // Envuelve caches.match en try/catch — en algunos contextos puede rechazar
  try {
    return caches.match(req).catch(() => undefined)
  } catch {
    return Promise.resolve(undefined)
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  let url
  try {
    url = new URL(e.request.url)
  } catch {
    return
  }

  // Ignorar chrome-extension y otros esquemas no http(s)
  if (!url.protocol.startsWith('http')) return

  // ── Google Fonts: cache-first con fallback silencioso ──────
  // No bloquear si falla — el browser usa fuentes del sistema
  const esFonts = url.hostname.includes('fonts.googleapis.com') ||
                  url.hostname.includes('fonts.gstatic.com')

  if (esFonts) {
    e.respondWith(
      safeMatch(e.request).then(cached => {
        if (cached) return cached
        return fetch(new Request(e.request.url, { mode: 'cors', credentials: 'omit' })).then(res => {
          if (res.ok) guardarEnCache(e.request, res)
          return res
        }).catch(() => {
          // Si Google Fonts falla, devolver respuesta vacía vacía — no bloquea el render
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': 'text/css' }
          })
        })
      })
    )
    return
  }

  // ── Google Storage (modelo hand_landmarker.task): cache-first ───────────
  const esGoogleStorage = url.hostname === 'storage.googleapis.com'

  if (esGoogleStorage) {
    e.respondWith(
      safeMatch(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok || res.type === 'opaque') guardarEnCache(e.request, res)
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // ── CDN jsDelivr: cache-first ─────────────────────────────
  const esCDN = url.hostname.includes('cdn.jsdelivr.net')

  if (esCDN) {
    e.respondWith(
      safeMatch(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok || res.type === 'opaque') guardarEnCache(e.request, res)
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // ── Navegación HTML: network-first ───────────────────────
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) guardarEnCache(e.request, res)
          return res
        })
        .catch(() =>
          safeMatch(e.request)
            .then(c => c ?? safeMatch('/'))
            .then(c => c ?? new Response(
              '<!doctype html><html lang="es"><meta charset="utf-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<title>YOSO — Sin conexión</title>' +
              '<style>body{margin:0;display:grid;place-items:center;min-height:100vh;' +
              'background:#0b1220;color:#e2e8f0;font:500 15px/1.5 system-ui,sans-serif;' +
              'text-align:center;padding:24px}h1{margin:0 0 12px;font-size:20px;color:#38BDF8}' +
              'p{margin:0;max-width:32ch;opacity:.8}</style>' +
              '<h1>YOSO sin conexión</h1>' +
              '<p>No hay red ni copia en caché. Reintenta cuando recuperes la conexión.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ))
        )
    )
    return
  }

  // ── Resto (JS, CSS, ONNX, WASM): cache-first ─────────────
  e.respondWith(
    safeMatch(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) guardarEnCache(e.request, res)
        return res
      }).catch(() => new Response('', { status: 503 }))
      return cached ?? networkFetch
    })
  )
})