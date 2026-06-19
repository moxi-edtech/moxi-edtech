import type { UserTenant } from "@/lib/getUserTenants";

export type ProductContext = "k12" | "formacao";

function resolveK12Path(tenant: UserTenant): string {
  const escolaParam = tenant.tenantSlug || tenant.tenantId;

  switch (tenant.role) {
    case "super_admin":
    case "global_admin":
      return "/super-admin";
    case "admin":
    case "admin_escola":
    case "staff_admin":
    case "admin_financeiro":
      return `/escola/${escolaParam}/admin/dashboard`;
    case "secretaria":
    case "secretaria_financeiro":
      return `/escola/${escolaParam}/secretaria`;
    case "financeiro":
      return `/escola/${escolaParam}/financeiro`;
    case "professor":
      return `/escola/${escolaParam}/professor`;
    case "aluno":
    case "encarregado":
      return `/escola/${escolaParam}/aluno/dashboard`;
    default:
      return `/escola/${escolaParam}/dashboard`;
  }
}

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

  return { product: "k12", path: resolveK12Path(tenant) };
}
