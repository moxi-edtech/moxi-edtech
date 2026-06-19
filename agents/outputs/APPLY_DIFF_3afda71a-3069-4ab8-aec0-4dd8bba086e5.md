# Agent 3 Apply Diff
run_id: 3afda71a-3069-4ab8-aec0-4dd8bba086e5
timestamp: 2026-06-19T00:00:00-03:00

## Targets
- apps/auth/app/redirect/page.tsx
- apps/web/src/middleware.ts

## Diff
```diff
@@ apps/auth/app/redirect/page.tsx
-  const hostIsLocal = Boolean(hostLanHostname || hostUsesLocalhost || hostUsesWildcardLocal);
+  const hintUsesLocalhost = redirectHints.some((hint) => {
+    const value = String(hint ?? "").trim().toLowerCase();
+    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes(".localhost");
+  });
+  const hostIsLocal = Boolean(hostLanHostname || hostUsesLocalhost || hostUsesWildcardLocal || hintUsesLocalhost);
@@ apps/web/src/middleware.ts
-  if (
-    process.env.NODE_ENV !== 'production' &&
-    isDocumentNavigation(request) &&
-    (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.localhost'))
-  ) {
-    const canonicalOrigin = (process.env.KLASSE_K12_LOCAL_ORIGIN ?? 'http://app.lvh.me:3001').trim();
-    try {
-      const canonical = new URL(canonicalOrigin);
-      if (canonical.host && canonical.host !== host) {
-        const next = request.nextUrl.clone();
-        next.protocol = canonical.protocol;
-        next.hostname = canonical.hostname;
-        next.port = canonical.port;
-        return NextResponse.redirect(next, 307);
-      }
-    } catch {
-      // ignore invalid canonical origin and continue normal flow
-    }
-  }
```
