const STATIC_CACHE = "klasse-static-v5";
const DATA_CACHE = "klasse-data-v1";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest-aluno.json",
  "/manifest-professor.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Prefixes for purely static Next.js assets
const STATIC_PREFIXES = ["/_next/static", "/icons", "/images"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DATA_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and cross-origin (except CDN if needed)
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Bypass cache for hard refreshes (manual refresh or post-action refresh)
  if (request.cache === 'no-store' || request.cache === 'no-cache') {
    return;
  }

  // 2. DATA STRATEGY: Stale-While-Revalidate (only for API student/public routes, plus safe professor routes)
  const PROFESSOR_CACHED_ENDPOINTS = [
    "/api/professor/atribuicoes",
    "/api/professor/pauta",
    "/api/professor/turmas", // matches turmas/[id]/alunos
    "/api/professor/periodos"
  ];

  const isStudentOrPublicData = url.pathname.startsWith("/api/aluno/") || url.pathname.startsWith("/api/public/");
  const isCachedProfessorData = PROFESSOR_CACHED_ENDPOINTS.some(path => url.pathname.startsWith(path));

  if ((isStudentOrPublicData || isCachedProfessorData) && !url.pathname.includes("/perfil/senha")) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const networkFetch = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });

          if (cachedResponse) {
            // Return cached response immediately, update cache in background silently
            networkFetch.catch(() => {
              // Fail silently on background fetch failure
            });
            return cachedResponse;
          }

          // Return network fetch directly if not in cache so it can throw network/offline errors
          return networkFetch;
        });
      })
    );
    return;
  }

  // 3. STATIC STRATEGY: Cache First
  const isStatic = STATIC_PREFIXES.some(p => url.pathname.startsWith(p)) || 
                   STATIC_ASSETS.includes(url.pathname) ||
                   url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ico)$/);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            return caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. NAVIGATION STRATEGY: Network First with Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL).then((offlineResponse) => {
          if (offlineResponse) return offlineResponse;
          // Robust HTML fallback response in case offline.html is missing
          return new Response(
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Offline - Klasse</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b}h1{color:#0f172a}p{color:#64748b}</style></head><body><h1>Dispositivo Offline</h1><p>Não foi possível carregar a página devido à falta de conexão de internet.</p></body></html>",
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            }
          );
        });
      })
    );
  }
});

// 5. PUSH NOTIFICATIONS (Placeholder for Phase 3)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Klasse", options)
    );
  } catch (e) {
    console.error("Push event error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/aluno/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// 6. CLEAR CACHE ON LOGOUT
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_DATA_CACHE") {
    event.waitUntil(
      caches.delete(DATA_CACHE).then(() => {
        console.log("[Service Worker] Cache de dados limpa com sucesso.");
      })
    );
  }
});
