// 2QT Service Worker — v3
// Strategies:
//   /_next/static/*   → Cache-First (hashed filenames, immutable)
//   images (*.png, *.jpg, *.webp, *.avif, ImageKit) → Cache-First (long TTL)
//   /api/v1/menu*     → Stale-While-Revalidate (serve cache, refresh in background)
//   /api/v1/*         → Network-First (auth, orders always fresh)
//   navigation        → Network-First + offline fallback

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `2qt-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `2qt-images-${CACHE_VERSION}`;
const API_CACHE     = `2qt-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/premium_healthy_bowl_1777968667530.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) =>
            cache.addAll(PRECACHE_ASSETS).catch(() => {})
        )
    );
    self.skipWaiting();
});

// ─── Activate — delete stale caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    const KEEP = [STATIC_CACHE, IMAGE_CACHE, API_CACHE];
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and browser extension requests
    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // 1. Next.js hashed static assets → Cache-First (safe to cache forever)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // 2. Images (local public dir + ImageKit CDN) → Cache-First (long TTL)
    if (
        url.hostname === 'ik.imagekit.io' ||
        /\.(png|jpg|jpeg|webp|avif|gif|svg|ico)(\?.*)?$/.test(url.pathname)
    ) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE));
        return;
    }

    // 3. Menu API → Stale-While-Revalidate (instant load, background refresh)
    if (url.pathname.includes('/api/v1/menu') || url.pathname.includes('/api/v1/banners')) {
        event.respondWith(staleWhileRevalidate(request, API_CACHE));
        return;
    }

    // 4. Other API calls → Network-First (auth, orders must be live)
    if (url.pathname.includes('/api/v1/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 5. Navigation (HTML pages) → Network-First + offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('/') || caches.match(request)
            )
        );
        return;
    }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Network error', { status: 408 });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);

    // Return cached immediately if we have it; otherwise await network
    return cached || fetchPromise;
}

async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'OFFLINE' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: { url: data.url || '/' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});

// ─── OTA Update trigger ───────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
