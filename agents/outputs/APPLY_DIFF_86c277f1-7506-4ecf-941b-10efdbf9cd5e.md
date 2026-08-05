# Apply diff — setup status requested year nullability

```diff
--- a/apps/web/src/app/api/escola/[id]/admin/setup/status/route.ts
+++ b/apps/web/src/app/api/escola/[id]/admin/setup/status/route.ts
@@
-    const requestedYear = requestedYearParam ? Number(requestedYearParam) : null;
-    if (requestedYearParam && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)) {
-      return NextResponse.json({ ok: false, error: 'Ano letivo inválido.' }, { status: 400 });
+    let requestedYear: number | null = null;
+    if (requestedYearParam) {
+      const parsedRequestedYear = Number(requestedYearParam);
+      if (!Number.isInteger(parsedRequestedYear) || parsedRequestedYear < 2000 || parsedRequestedYear > 2100) {
+        return NextResponse.json({ ok: false, error: 'Ano letivo inválido.' }, { status: 400 });
+      }
+      requestedYear = parsedRequestedYear;
     }
```
