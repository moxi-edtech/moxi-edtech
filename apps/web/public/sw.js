const CACHE = "klasse-static-v2";
const OFFLINE_URL = "/offline.html";
const STATIC_PREFIXES = ["/_next/static", "/icons", "/manifest.json"];

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
  const isStaticAsset =
    isSameOrigin &&
    (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
      url.pathname === OFFLINE_URL ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico"));
  event.respondWith(
    (async () => {
      if (isStaticAsset) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      }

      if (isSameOrigin && isNavigation) {
        try {
          return await fetch(req);
        } catch {
          const fallback = await caches.match(OFFLINE_URL);
          return fallback || new Response("Offline", { status: 503 });
        }
      }

      return fetch(req);
    })()
  );
});
