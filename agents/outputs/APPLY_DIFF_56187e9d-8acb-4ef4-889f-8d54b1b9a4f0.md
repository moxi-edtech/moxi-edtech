# Agent 3 Apply Diff
run_id: 56187e9d-8acb-4ef4-889f-8d54b1b9a4f0
timestamp: 2026-06-19T00:00:00-03:00

## Target
apps/auth/app/redirect/page.tsx

## Diff
```diff
@@
-import {
-  clearTenantContextCookie,
-  getTenantContextCookieForUser,
-  setTenantContextCookie,
-} from "@/lib/tenantContextCookie";
+import { getTenantContextCookieForUser } from "@/lib/tenantContextCookie";
@@
-  if (!user) {
-    await clearTenantContextCookie();
+  if (!user) {
@@
-  if (cachedContext && !cachedTenant) {
-    await clearTenantContextCookie();
+  if (cachedContext && !cachedTenant) {
@@
-  if (passwordChangeDestination) {
-    await setTenantContextCookie({
-      uid: user.id,
-      tenant_id: selected.tenantId,
-      tenant_slug: selected.tenantSlug,
-      tenant_type: selected.tenantType,
-      role: selected.role,
-    });
-
+  if (passwordChangeDestination) {
@@
-  await setTenantContextCookie({
-    uid: user.id,
-    tenant_id: selected.tenantId,
-    tenant_slug: selected.tenantSlug,
-    tenant_type: selected.tenantType,
-    role: selected.role,
-  });
-
```
