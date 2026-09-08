// DaddyAI Service Worker — v2
// Strategy:
//   - App shell (HTML/JS/CSS): Network-first with cache fallback
//   - Static assets (icons, fonts): Cache-first, 30-day TTL
//   - API routes (/api/*, /ws/*): Network-only (never cache)
//   - Offline fallback: /admin served from cache

const SHELL_CACHE = 'daddyai-shell-v2';
const ASSET_CACHE = 'daddyai-assets-v2';

const PRECACHE_ASSETS = [
  '/',
  '/admin',
  '/auth',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/logo.png',
];

const NEVER_CACHE = [
  '/api/',
  '/ws/',
  'supabase.co',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Install: precache shell ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Use individual requests to avoid failing on one bad URL
      Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((res) => { if (res.ok) cache.put(url, res); })
            .catch(() => {}) // ignore failures during install
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache: API, WebSocket, external services
  if (
    NEVER_CACHE.some((p) => url.pathname.startsWith(p) || url.href.includes(p)) ||
    request.method !== 'GET'
  ) {
    return; // let browser handle normally
  }

  // 2. Static assets (icons, images): cache-first, 30-day TTL
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // 3. App shell / pages: network-first with cache fallback
  event.respondWith(networkFirstWithFallback(request));
});

// ── Strategies ─────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    // Offline: return cached version
    const cached = await caches.match(request);
    if (cached) return cached;
    // Ultimate fallback: serve /admin from cache
    const fallback = await caches.match('/admin');
    if (fallback) return fallback;
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DaddyAI — Offline</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;background:#020806;color:#f4f7f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;}
.logo{width:64px;height:64px;background:#68f044;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#020806;font-weight:800;}
h1{font-size:1.4rem;margin:0;}p{color:#9baaa3;margin:0;text-align:center;}</style></head>
<body><div class="logo">▣</div><h1>DaddyAI</h1>
<p>ইন্টারনেট সংযোগ নেই।<br>সংযোগ ফিরে এলে পুনরায় চেষ্টা করুন।</p>
<button onclick="location.reload()" style="margin-top:8px;padding:10px 24px;background:#68f044;color:#020806;border:0;border-radius:24px;font-weight:700;cursor:pointer;">Retry</button>
</body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── Background sync placeholder ────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
