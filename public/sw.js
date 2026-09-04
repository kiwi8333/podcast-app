// Hand-rolled rather than Workbox: this needs four rules, and a build-step
// dependency to express them would be more machinery than the problem.
//
// Bump VERSION to retire every old cache on the next activate.
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;

// Artwork accumulates fast — one image per show, per search result. Capped so
// a heavy browsing session can't fill the origin's storage quota and get the
// whole cache evicted out from under us.
const IMAGE_LIMIT = 150;

const OFFLINE_FALLBACK = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add(OFFLINE_FALLBACK))
      .catch(() => {}) // a failed precache must not block activation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache API keys come back in insertion order, so the front is the oldest.
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    await cache.delete(key);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // status 0 is an opaque cross-origin response (podcast artwork). It can't
  // be inspected, but it can be cached and replayed, which is the point.
  if (response.status === 200 || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (cacheName === IMAGE_CACHE) trimCache(IMAGE_CACHE, IMAGE_LIMIT);
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    const fallback = await cache.match(OFFLINE_FALLBACK);
    if (fallback) return fallback;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and a Range request must reach the network
  // untouched — serving a stored full response to a range request breaks
  // audio seeking outright.
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // The API is deliberately left alone. /api/audio is huge and ranged,
  // /api/ai/* costs money per call, and /api/feed has its own conditional
  // request + IndexedDB caching in the app — a second cache layer here would
  // only fight it and hide 304s.
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // Next's build output is content-hashed, so it is safe to serve forever.
  if (sameOrigin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});
