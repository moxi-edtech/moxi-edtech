# Apply Diff
run_id: auth-lan-redirect-20260619
timestamp: 2026-06-19T17:27:00Z

```diff
diff --git a/apps/auth/app/redirect/page.tsx b/apps/auth/app/redirect/page.tsx
index a5831afc..3dff474b 100644
--- a/apps/auth/app/redirect/page.tsx
+++ b/apps/auth/app/redirect/page.tsx
@@ -4,11 +4,7 @@ import { supabaseServer } from "@/lib/supabaseServer";
 import { getUserTenants } from "@/lib/getUserTenants";
 import { logAuthEvent } from "@/lib/auth-log";
 import { resolveTenantRoute } from "@/lib/resolveTenantRoute";
-import {
-  clearTenantContextCookie,
-  getTenantContextCookieForUser,
-  setTenantContextCookie,
-} from "@/lib/tenantContextCookie";
+import { getTenantContextCookieForUser } from "@/lib/tenantContextCookie";
 
 type GlobalRole = "super_admin" | "global_admin" | null;
 
@@ -40,11 +36,24 @@ function getPrivateLanHostname(value: string) {
 }
 
 function resolveProductBases(host: string, ...redirectHints: Array<string | null | undefined>) {
-  const hostIsLocal = isLocalOrigin(host) || redirectHints.some((hint) => isLocalOrigin(hint ?? ""));
+  const normalizedHost = host.trim().toLowerCase();
+  const hostLanHostname = getPrivateLanHostname(normalizedHost);
+  const hostUsesLocalhost =
+    normalizedHost.includes("localhost") ||
+    normalizedHost.includes("127.0.0.1") ||
+    normalizedHost.includes(".localhost");
+  const hostUsesWildcardLocal = normalizedHost.includes(".lvh.me");
+  const hintUsesLocalhost = redirectHints.some((hint) => {
+    const value = String(hint ?? "").trim().toLowerCase();
+    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes(".localhost");
+  });
+  const hostIsLocal = Boolean(hostLanHostname || hostUsesLocalhost || hostUsesWildcardLocal || hintUsesLocalhost);
   const isLocalHost = hostIsLocal && process.env.NODE_ENV !== "production";
 
   if (isLocalHost) {
-    const lanHostname = getPrivateLanHostname(host) || redirectHints.map((hint) => getPrivateLanHostname(hint ?? "")).find(Boolean);
+    const lanHostname =
+      hostLanHostname ||
+      redirectHints.map((hint) => getPrivateLanHostname(hint ?? "")).find(Boolean);
     if (lanHostname) {
       return {
         k12: `http://${lanHostname}:3001`,
@@ -52,10 +61,7 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
       };
     }
 
-    const prefersLocalhost =
-      host.includes("localhost") ||
-      host.includes(".localhost") ||
-      redirectHints.some((hint) => isLocalOrigin(hint ?? "") && String(hint ?? "").toLowerCase().includes("localhost"));
+    const prefersLocalhost = hostUsesLocalhost || hintUsesLocalhost;
 
     if (prefersLocalhost) {
       return {
@@ -74,9 +80,15 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
     };
   }
 
+  const configuredK12 = process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim();
+  const configuredFormacao = process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim();
+
   return {
-    k12: process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim() || "https://app.klasse.ao",
-    formacao: process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim() || "https://formacao.klasse.ao",
+    k12: configuredK12 && !isLocalOrigin(configuredK12) ? configuredK12 : "https://app.klasse.ao",
+    formacao:
+      configuredFormacao && !isLocalOrigin(configuredFormacao)
+        ? configuredFormacao
+        : "https://formacao.klasse.ao",
   };
 }
 
@@ -156,7 +168,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
   const loginSuffix = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : "";
 
   if (!user) {
-    await clearTenantContextCookie();
     logAuthEvent({
       action: "resolve_context_failed",
       route: "/redirect",
@@ -184,8 +195,18 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
     }
   };
 
+  const tenants = await getUserTenants(user.id);
   const cachedContext = await getTenantContextCookieForUser(user.id);
-  if (cachedContext) {
+  const cachedTenant =
+    cachedContext
+      ? tenants.find((tenant) =>
+          tenant.tenantId === cachedContext.tenant_id &&
+          tenant.tenantType === cachedContext.tenant_type &&
+          tenant.role === cachedContext.role
+        ) ?? null
+      : null;
+
+  if (cachedContext && cachedTenant) {
     const bases = resolveProductBases(host, params.redirect, originHint, refererHint);
     const destinationConfig = resolveTenantRoute({
       tenantId: cachedContext.tenant_id,
@@ -226,7 +247,15 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
     redirect(destination);
   }
 
-  const tenants = await getUserTenants(user.id);
+  if (cachedContext && !cachedTenant) {
+    logAuthEvent({
+      action: "resolve_context_failed",
+      route: "/redirect",
+      user_id: user.id,
+      details: { reason: "stale_tenant_context_cookie" },
+    });
+  }
+
   const globalRole = await resolveGlobalRole(supabase, user.id, user.user_metadata, user.app_metadata);
 
   if (tenants.length === 0 && globalRole) {
@@ -277,14 +306,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
     ? resolvePasswordChangeDestination(productBase, destinationConfig.product)
     : null;
   if (passwordChangeDestination) {
-    await setTenantContextCookie({
-      uid: user.id,
-      tenant_id: selected.tenantId,
-      tenant_slug: selected.tenantSlug,
-      tenant_type: selected.tenantType,
-      role: selected.role,
-    });
-
     logAuthEvent({
       action: "redirect",
       route: "/redirect",
@@ -301,14 +322,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
     ? preferred
     : `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;
 
-  await setTenantContextCookie({
-    uid: user.id,
-    tenant_id: selected.tenantId,
-    tenant_slug: selected.tenantSlug,
-    tenant_type: selected.tenantType,
-    role: selected.role,
-  });
-
   logAuthEvent({
     action: "redirect",
     route: "/redirect",

```
