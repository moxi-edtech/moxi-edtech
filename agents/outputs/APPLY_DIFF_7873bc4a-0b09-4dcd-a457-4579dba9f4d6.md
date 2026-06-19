# Apply Diff
run_id: 7873bc4a-0b09-4dcd-a457-4579dba9f4d6
timestamp: 2026-06-19T16:00:00Z

```diff
diff --git a/apps/auth/app/redirect/page.tsx b/apps/auth/app/redirect/page.tsx
index a5831afc..31017eb7 100644
--- a/apps/auth/app/redirect/page.tsx
+++ b/apps/auth/app/redirect/page.tsx
@@ -61,7 +61,7 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
       };
     }
 
-    const prefersLocalhost = hostUsesLocalhost;
+    const prefersLocalhost = hostUsesLocalhost || hintUsesLocalhost;
 
     if (prefersLocalhost) {
       return {
diff --git a/apps/web/src/middleware.ts b/apps/web/src/middleware.ts
index 05f90626..d7687930 100644
--- a/apps/web/src/middleware.ts
+++ b/apps/web/src/middleware.ts
@@ -232,6 +232,26 @@ function isLocalhostHost(host: string | null | undefined) {
   return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
 }
 
+function resolveCurrentAppOrigin(request: NextRequest) {
+  if (process.env.NODE_ENV === 'production') {
+    return request.nextUrl.origin;
+  }
+
+  const hostHeader = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
+    .split(',')[0]
+    .trim()
+    .toLowerCase();
+
+  if (isLocalhostHost(hostHeader)) {
+    return safeAbsoluteUrl(
+      process.env.KLASSE_K12_LOCALHOST_ORIGIN,
+      request.nextUrl.origin
+    );
+  }
+
+  return request.nextUrl.origin;
+}
+
 function safeAbsoluteUrl(
   value: string | undefined,
   fallback: string
@@ -562,12 +582,8 @@ function redirectToCentralAuth(request: NextRequest, baseResponse: NextResponse)
   );
   const hasStaleContextHint = hasTenantContextCookie(request) || hasLikelySupabaseSessionCookie(request);
   const canonicalReturnTo =
-    process.env.NODE_ENV !== 'production'
-      ? new URL(
-          `${request.nextUrl.pathname}${request.nextUrl.search}`,
-          canonicalOrigin
-        ).toString()
-      : request.nextUrl.href;
+    process.env.NODE_ENV !== 'production'
+      ? new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, resolveCurrentAppOrigin(request)).toString()
+      : request.nextUrl.href;
   loginUrl.searchParams.set('redirect', canonicalReturnTo);
   if (hasStaleContextHint) {
     loginUrl.searchParams.set('error', 'context');
```
