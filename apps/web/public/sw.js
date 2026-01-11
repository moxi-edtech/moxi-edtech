const CACHE = "klasse-static-v1";
const OFFLINE_URL = "/offline.html";
const CRITICAL_PATHS = ["/secretaria", "/admin"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([OFFLINE_URL, "/manifest.json"]);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isNavigation = req.mode === "navigate";
  const isCritical = CRITICAL_PATHS.some((path) => url.pathname.startsWith(path));
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (isSameOrigin && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        if (isSameOrigin && isNavigation && isCritical) {
          const cached = await caches.match(req);
          if (cached) return cached;
        }
        const cached = await caches.match(req);
        return cached || caches.match(OFFLINE_URL);
      }
    })()
  );
});
