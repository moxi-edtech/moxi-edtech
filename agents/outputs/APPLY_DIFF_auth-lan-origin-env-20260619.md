# Apply Diff
run_id: auth-lan-origin-env-20260619
timestamp: 2026-06-19T17:32:00Z

```diff
diff --git a/apps/auth/app/redirect/page.tsx b/apps/auth/app/redirect/page.tsx
index a5831afc..317c0554 100644
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
 
@@ -39,12 +35,57 @@ function getPrivateLanHostname(value: string) {
   }
 }
 
+function resolveLanProductBases() {
+  const k12 = process.env.KLASSE_K12_LAN_ORIGIN?.trim();
+  const formacao = process.env.KLASSE_FORMACAO_LAN_ORIGIN?.trim();
+
+  if (!k12) return null;
+
+  try {
+    const k12Url = new URL(k12);
+    if (!getPrivateLanHostname(k12Url.toString())) return null;
+
+    if (formacao) {
+      const formacaoUrl = new URL(formacao);
+      if (getPrivateLanHostname(formacaoUrl.toString())) {
+        return {
+          k12: k12Url.toString().replace(/\/$/, ""),
+          formacao: formacaoUrl.toString().replace(/\/$/, ""),
+        };
+      }
+    }
+
+    const derivedFormacao = new URL(k12Url.toString());
+    derivedFormacao.port = "3002";
+
+    return {
+      k12: k12Url.toString().replace(/\/$/, ""),
+      formacao: derivedFormacao.toString().replace(/\/$/, ""),
+    };
+  } catch {
+    return null;
+  }
+}
+
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
@@ -52,12 +93,12 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
       };
     }
 
-    const prefersLocalhost =
-      host.includes("localhost") ||
-      host.includes(".localhost") ||
-      redirectHints.some((hint) => isLocalOrigin(hint ?? "") && String(hint ?? "").toLowerCase().includes("localhost"));
+    const prefersLocalhost = hostUsesLocalhost || hintUsesLocalhost;
 
     if (prefersLocalhost) {
+      const lanBases = resolveLanProductBases();
+      if (lanBases) return lanBases;
+
       return {
         k12: process.env.KLASSE_K12_LOCALHOST_ORIGIN?.trim() || "http://localhost:3001",
         formacao: process.env.KLASSE_FORMACAO_LOCALHOST_ORIGIN?.trim() || "http://localhost:3002",
@@ -74,9 +115,15 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
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
 
@@ -156,7 +203,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
   const loginSuffix = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : "";
 
   if (!user) {
-    await clearTenantContextCookie();
     logAuthEvent({
       action: "resolve_context_failed",
       route: "/redirect",
@@ -184,8 +230,18 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
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
@@ -226,7 +282,15 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
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
@@ -277,14 +341,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
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
@@ -301,14 +357,6 @@ export default async function RedirectPage({ searchParams }: { searchParams: Sea
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
diff --git a/apps/auth/app/select-context/choose/route.ts b/apps/auth/app/select-context/choose/route.ts
index c85de76b..db1b31aa 100644
--- a/apps/auth/app/select-context/choose/route.ts
+++ b/apps/auth/app/select-context/choose/route.ts
@@ -31,6 +31,38 @@ function getPrivateLanHostname(value: string) {
   }
 }
 
+function resolveLanProductBases() {
+  const k12 = process.env.KLASSE_K12_LAN_ORIGIN?.trim();
+  const formacao = process.env.KLASSE_FORMACAO_LAN_ORIGIN?.trim();
+
+  if (!k12) return null;
+
+  try {
+    const k12Url = new URL(k12);
+    if (!getPrivateLanHostname(k12Url.toString())) return null;
+
+    if (formacao) {
+      const formacaoUrl = new URL(formacao);
+      if (getPrivateLanHostname(formacaoUrl.toString())) {
+        return {
+          k12: k12Url.toString().replace(/\/$/, ""),
+          formacao: formacaoUrl.toString().replace(/\/$/, ""),
+        };
+      }
+    }
+
+    const derivedFormacao = new URL(k12Url.toString());
+    derivedFormacao.port = "3002";
+
+    return {
+      k12: k12Url.toString().replace(/\/$/, ""),
+      formacao: derivedFormacao.toString().replace(/\/$/, ""),
+    };
+  } catch {
+    return null;
+  }
+}
+
 function resolveProductBases(host: string, ...redirectHints: Array<string | null | undefined>) {
   const hints = redirectHints.map((hint) => String(hint ?? "").toLowerCase());
   const isLocalHost =
@@ -53,6 +85,9 @@ function resolveProductBases(host: string, ...redirectHints: Array<string | null
       hints.some((hint) => hint.includes("localhost"));
 
     if (prefersLocalhost) {
+      const lanBases = resolveLanProductBases();
+      if (lanBases) return lanBases;
+
       return {
         k12: process.env.KLASSE_K12_LOCALHOST_ORIGIN?.trim() || "http://localhost:3001",
         formacao: process.env.KLASSE_FORMACAO_LOCALHOST_ORIGIN?.trim() || "http://localhost:3002",

```
