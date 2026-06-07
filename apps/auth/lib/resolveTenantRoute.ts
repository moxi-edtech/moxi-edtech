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

  if (tenant.role === "aluno" || tenant.role === "encarregado") {
    const escolaParam = tenant.tenantSlug || tenant.tenantId;
    return { product: "k12", path: `/escola/${escolaParam}/aluno/dashboard` };
  }

  // For remaining K12 roles, hand off to app redirect resolver so admin/onboarding gates are respected.
  return { product: "k12", path: "/redirect" };
}
