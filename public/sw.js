const CACHE = 'yoso-v12'

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
  // caches.match puede rechazar en algunos contextos (ServiceWorker sin scope correcto)
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

  if (!url.protocol.startsWith('http')) return

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

  // Assets Vite van hasheados (inmutables); los no hasheados se invalidan subiendo CACHE.
  e.respondWith(
    safeMatch(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res.ok) guardarEnCache(e.request, res)
        return res
      }).catch(() => new Response('', { status: 503 }))
    })
  )
})
