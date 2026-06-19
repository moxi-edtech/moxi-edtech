# Agent 3 Apply Diff
run_id: 29cd3df9-c8b2-40c0-a057-db8e5db1925c
timestamp: 2026-06-19T00:00:00-03:00

## Target
apps/web/src/middleware.ts

## Diff
```diff
@@
+function isDocumentNavigation(request: NextRequest) {
+  if (request.nextUrl.searchParams.has('_rsc')) return false;
+  if (request.headers.get('x-nextjs-data')) return false;
+  const accept = request.headers.get('accept') ?? '';
+  return accept.includes('text/html');
+}
@@
-  if (
-    process.env.NODE_ENV !== 'production' &&
-    (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.localhost'))
-  ) {
+  if (
+    process.env.NODE_ENV !== 'production' &&
+    isDocumentNavigation(request) &&
+    (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.localhost'))
+  ) {
```
