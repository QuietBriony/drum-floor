/* =========================================================
   Drum Floor - Service Worker
   - Precaches the static Pages shell and local module graph.
   - Keeps cache cleanup scoped to drum-floor cache names only.
   - Network-first for HTML and JSON so deploys propagate quickly.
   - Bypasses non-GET and Range requests.
========================================================= */

const CACHE_PREFIX = "drum-floor-pwa";
const VERSION = `${CACHE_PREFIX}-v3`;
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SCOPE_URL = new URL(self.registration.scope);

const PRECACHE_URLS = [
  "./",
  "index.html",
  "style.css?v=pwa-3",
  "app.js?v=pwa-3",
  "manifest.webmanifest",
  "profiles/groove-profiles.json",
  "patterns/drum-pattern-frames.json",
  "src/audio-analysis.js",
  "src/audio-engine.js?v=pwa-3",
  "src/contracts.js",
  "src/coplayer.js",
  "src/groove-engine.js",
  "src/manual-controls.js",
  "src/midi-output.js",
  "src/music-session-adapter.js",
  "src/session-adapter.js",
  "src/ui-render.js",
  "icons/icon-96.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((error) => {
              console.warn("[Drum Floor SW] precache miss:", url, error);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isLocalAppUrl(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE_URL.pathname);
}

function isHtmlRequest(request) {
  return request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

function isDataRequest(url) {
  return isLocalAppUrl(url) && (url.pathname.includes("/profiles/") || url.pathname.includes("/patterns/")) && url.pathname.endsWith(".json");
}

function matchCachedRequest(request, options = {}) {
  return caches.match(request).then((cached) => {
    if (cached || !options.ignoreSearch) return cached;
    return caches.match(request, { ignoreSearch: true });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.get("range")) return;

  const url = new URL(request.url);
  if (!isLocalAppUrl(url)) return;

  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => matchCachedRequest(request, { ignoreSearch: true }).then((cached) => cached || caches.match("index.html")))
    );
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => matchCachedRequest(request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    matchCachedRequest(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
