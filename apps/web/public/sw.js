const CACHE = "klasse-static-v1";
const OFFLINE_URL = "/offline.html";

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
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (new URL(req.url).origin === location.origin && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match(OFFLINE_URL);
      }
    })()
  );
});
