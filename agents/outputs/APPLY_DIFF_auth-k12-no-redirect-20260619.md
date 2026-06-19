# Apply Diff
run_id: auth-k12-no-redirect-20260619
timestamp: 2026-06-19T10:52:00Z

```diff
diff --git a/apps/auth/lib/resolveTenantRoute.ts b/apps/auth/lib/resolveTenantRoute.ts
index defc78a9..3104cbeb 100644
--- a/apps/auth/lib/resolveTenantRoute.ts
+++ b/apps/auth/lib/resolveTenantRoute.ts
@@ -2,6 +2,33 @@ import type { UserTenant } from "@/lib/getUserTenants";
 
 export type ProductContext = "k12" | "formacao";
 
+function resolveK12Path(tenant: UserTenant): string {
+  const escolaParam = tenant.tenantSlug || tenant.tenantId;
+
+  switch (tenant.role) {
+    case "super_admin":
+    case "global_admin":
+      return "/super-admin";
+    case "admin":
+    case "admin_escola":
+    case "staff_admin":
+    case "admin_financeiro":
+      return `/escola/${escolaParam}/admin/dashboard`;
+    case "secretaria":
+    case "secretaria_financeiro":
+      return `/escola/${escolaParam}/secretaria`;
+    case "financeiro":
+      return `/escola/${escolaParam}/financeiro`;
+    case "professor":
+      return `/escola/${escolaParam}/professor`;
+    case "aluno":
+    case "encarregado":
+      return `/escola/${escolaParam}/aluno/dashboard`;
+    default:
+      return `/escola/${escolaParam}/dashboard`;
+  }
+}
+
 export function resolveTenantRoute(tenant: UserTenant): { product: ProductContext; path: string } {
   if (tenant.tenantType === "solo_creator") {
     return { product: "formacao", path: "/mentor/dashboard" };
@@ -15,11 +42,5 @@ export function resolveTenantRoute(tenant: UserTenant): { product: ProductContex
     return { product: "formacao", path: "/admin/dashboard" };
   }
 
-  if (tenant.role === "aluno" || tenant.role === "encarregado") {
-    const escolaParam = tenant.tenantSlug || tenant.tenantId;
-    return { product: "k12", path: `/escola/${escolaParam}/aluno/dashboard` };
-  }
-
-  // For remaining K12 roles, hand off to app redirect resolver so admin/onboarding gates are respected.
-  return { product: "k12", path: "/redirect" };
+  return { product: "k12", path: resolveK12Path(tenant) };
 }
diff --git a/apps/auth/tests/integration/tenant-routing-matrix.spec.ts b/apps/auth/tests/integration/tenant-routing-matrix.spec.ts
index 34b0c709..d4b442e9 100644
--- a/apps/auth/tests/integration/tenant-routing-matrix.spec.ts
+++ b/apps/auth/tests/integration/tenant-routing-matrix.spec.ts
@@ -55,7 +55,7 @@ test("Integração auth: solo_creator ignora namespace center no pós-login", ()
   assert.deepEqual(solo, { product: "formacao", path: "/mentor/dashboard" });
 });
 
-test("Integração auth: k12 mantém handoff para redirect canônico", () => {
+test("Integração auth: k12 admin evita handoff para redirect canônico", () => {
   const k12 = resolveTenantRoute({
     tenantId: "k12-1",
     tenantName: "K12",
@@ -63,6 +63,5 @@ test("Integração auth: k12 mantém handoff para redirect canônico", () => {
     role: "admin",
   });
 
-  assert.deepEqual(k12, { product: "k12", path: "/redirect" });
+  assert.deepEqual(k12, { product: "k12", path: "/escola/k12-1/admin/dashboard" });
 });
-
diff --git a/apps/auth/tests/unit/resolveTenantRoute.spec.ts b/apps/auth/tests/unit/resolveTenantRoute.spec.ts
index dadb04e2..ebf25579 100644
--- a/apps/auth/tests/unit/resolveTenantRoute.spec.ts
+++ b/apps/auth/tests/unit/resolveTenantRoute.spec.ts
@@ -26,7 +26,7 @@ test("resolveTenantRoute: formacao_financeiro aponta para financeiro", () => {
   assert.equal(resolved.path, "/financeiro/dashboard");
 });
 
-test("resolveTenantRoute: k12 mantém handoff para redirect", () => {
+test("resolveTenantRoute: k12 admin aponta directo para dashboard da escola", () => {
   const resolved = resolveTenantRoute({
     tenantId: "tenant-k12",
     tenantName: "K12",
@@ -35,5 +35,5 @@ test("resolveTenantRoute: k12 mantém handoff para redirect", () => {
   });
 
   assert.equal(resolved.product, "k12");
-  assert.equal(resolved.path, "/redirect");
+  assert.equal(resolved.path, "/escola/tenant-k12/admin/dashboard");
 });

```
