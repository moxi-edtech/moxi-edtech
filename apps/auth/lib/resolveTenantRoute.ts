import type { UserTenant } from "@/lib/getUserTenants";

export type ProductContext = "k12" | "formacao";

export function resolveTenantRoute(tenant: UserTenant): { product: ProductContext; path: string } {
  if (tenant.tenantType === "formacao") {
    if (tenant.role === "formador") return { product: "formacao", path: "/agenda" };
    if (tenant.role === "formando") return { product: "formacao", path: "/dashboard" };
    return { product: "formacao", path: "/admin/dashboard" };
  }

  // For K12, always hand off to app redirect resolver so school slug/context is respected.
  return { product: "k12", path: "/redirect" };
}
