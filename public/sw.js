// ── Firebase Cloud Messaging (background notifications) ───────────────────────
// importScripts must come first so firebase globals are defined before use
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyBoGKiGTQXgAlUcBLDl-5PvfeKEYWUPwK8',
  authDomain:        'nuso-store.firebaseapp.com',
  projectId:         'nuso-store',
  storageBucket:     'nuso-store.firebasestorage.app',
  messagingSenderId: '808702557958',
  appId:             '1:808702557958:web:6d81c7471f093512fb6887',
})

const messaging = firebase.messaging()

// Called when a push arrives while the app is in the background or closed
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] background message received:', payload)
  const { title, body, icon } = payload.notification || {}
  return self.registration.showNotification(title || 'Nuso Store', {
    body:    body  || '',
    icon:    icon  || '/nuso-icon.png',
    badge:         '/nuso-icon.png',
    data:    payload.data || {},
    tag:    'nuso-push',
  })
})

// Open or focus the app tab when user taps a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes(self.location.origin) && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// ── PWA caching ───────────────────────────────────────────────────────────────
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add('/'))
  )
  self.skipWaiting()
})

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone synchronously before any async operation or return so the
          // original body isn't consumed before the clone is made.
          if (!response.bodyUsed) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          }
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

  // Static assets: cache-first, populate on miss
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Must clone synchronously here — BEFORE `return response` hands the body
        // to the browser. Cloning inside the async caches.open().then() callback
        // is too late: the body is already consumed by then, causing
        // "Failed to execute clone on Response: Response body is already used".
        if (response.ok && !response.bodyUsed) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
        }
        return response
      })
    })
  )
})
