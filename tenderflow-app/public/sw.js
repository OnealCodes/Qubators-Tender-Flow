/* TenderFlow service worker — static assets + offline fallback only.
 *
 * NEVER cached here: API responses (/api/*), auth/session traffic, tender
 * PDFs, evidence uploads, or any authenticated page content. Those always go
 * to the network so nothing sensitive persists across sessions on the device.
 *
 * Strategy:
 * - Navigations: network first, fall back to /offline.html when offline.
 * - Versioned static assets (_next/static, /icons/*, manifest): cache first.
 * - Everything else (incl. all /api/*): network only, never stored.
 */

const STATIC_CACHE = "tenderflow-static-v1";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

function isApiOrAuth(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/sign-");
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return /\.(png|svg|ico|webmanifest|css|js)$/.test(url.pathname) && !url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sensitive or dynamic traffic: network only, never cached.
  if (isApiOrAuth(url)) return;

  // Page navigations: try network, show the offline page when unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets: cache first, fall back to network.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
  // Anything else: network only (default browser behaviour).
});
