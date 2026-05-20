const CACHE_NAME = 'nuso-v1'

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuso Store — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;background:#f7f7f7;color:#111;text-align:center;padding:1.5rem}
    .logo{font-size:1.8rem;font-weight:900;color:#1a2340;letter-spacing:.05em;margin-bottom:.5rem}
    .logo span{color:#FF6B00}
    p{color:#666;max-width:260px;line-height:1.55;margin-top:.5rem;font-size:.95rem}
    button{margin-top:1.75rem;padding:.75rem 2.25rem;background:#FF6B00;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <div class="logo">NUSO <span>STORE</span></div>
  <p>You're offline. Check your connection and try again.</p>
  <button onclick="location.reload()">Try Again</button>
</body></html>`

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add('/'))
  )
  self.skipWaiting()
})

// ── Activate: delete stale caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignore non-GET and cross-origin requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Navigation: network-first → cached shell → inline offline page
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(async () => {
          const cached = await caches.match('/')
          if (cached) return cached
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        })
    )
    return
  }

  // Static assets (JS, CSS, images): cache-first, populate cache on miss
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
    })
  )
})
