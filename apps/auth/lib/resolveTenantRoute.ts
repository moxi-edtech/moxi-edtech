import type { UserTenant } from "@/lib/getUserTenants";

export type ProductContext = "k12" | "formacao";

export function resolveTenantRoute(tenant: UserTenant): { product: ProductContext; path: string } {
  if (tenant.tenantType === "solo_creator") {
    return { product: "formacao", path: "/mentor/dashboard" };
  }

  if (tenant.tenantType === "formacao") {
    if (tenant.role === "formacao_secretaria") return { product: "formacao", path: "/secretaria/catalogo-cursos" };
    if (tenant.role === "formacao_financeiro") return { product: "formacao", path: "/financeiro/dashboard" };
    if (tenant.role === "formador") return { product: "formacao", path: "/agenda" };
    if (tenant.role === "formando") return { product: "formacao", path: "/meus-cursos" };
    return { product: "formacao", path: "/admin/dashboard" };
  }

  // For K12, always hand off to app redirect resolver so school slug/context is respected.
  return { product: "k12", path: "/redirect" };
}
