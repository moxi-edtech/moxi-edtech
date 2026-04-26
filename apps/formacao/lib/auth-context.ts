import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { normalizeRoleForTenant, type CanonicalFormacaoRole } from "@/lib/role-semantics";

export type FormacaoRole = CanonicalFormacaoRole;

export type FormacaoAuthContext = {
  userId: string;
  displayName: string | null;
  role: FormacaoRole | null;
  tenantId: string | null;
  tenantSlug: string | null;
  escolaId: string | null;
  tenantName: string | null;
  tenantType: "k12" | "formacao" | "solo_creator" | null;
};

export async function getFormacaoAuthContext(): Promise<FormacaoAuthContext | null> {
  const session = await resolveFormacaoSessionContext();
  if (!session) return null;

  const roleRaw = String(session.role ?? "").trim().toLowerCase();
  const tenantRaw = String(session.tenantType ?? "")
    .trim()
    .toLowerCase();
  const normalizedTenantType =
    tenantRaw === "k12" || tenantRaw === "formacao" || tenantRaw === "solo_creator"
      ? tenantRaw
      : null;

  return {
    userId: session.userId,
    displayName: session.displayName,
    role: normalizeRoleForTenant(roleRaw, normalizedTenantType),
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
    escolaId: session.tenantId,
    tenantName: session.tenantName,
    tenantType: normalizedTenantType,
  };
}

export function getDefaultFormacaoPath(
  role: string | null | undefined,
  tenantType?: "k12" | "formacao" | "solo_creator" | null
): string {
  if (tenantType === "solo_creator") {
    return "/mentor/dashboard";
  }
  switch (role) {
    case "formacao_admin":
    case "super_admin":
    case "global_admin":
      return "/admin/dashboard";
    case "formacao_secretaria":
      return "/secretaria/catalogo-cursos";
    case "formacao_financeiro":
      return "/financeiro/dashboard";
    case "formador":
      return "/agenda";
    case "formando":
      return "/meus-cursos";
    case "solo_admin":
      return "/mentor/dashboard";
    default:
      return "/dashboard";
  }
}

export function canAccessFormacaoPath(role: string | null | undefined, pathname: string): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const isAdminRole =
    normalized === "formacao_admin" || normalized === "super_admin" || normalized === "global_admin";

  if (pathname.startsWith("/admin")) {
    return isAdminRole;
  }

  if (pathname.startsWith("/mentor")) {
    return isAdminRole || normalized === "solo_admin";
  }

  if (pathname.startsWith("/secretaria")) {
    return isAdminRole || normalized === "formacao_secretaria";
  }

  if (pathname.startsWith("/financeiro")) {
    return isAdminRole || normalized === "formacao_financeiro";
  }

  if (pathname.startsWith("/agenda") || pathname.startsWith("/honorarios")) {
    if (pathname.startsWith("/agenda")) {
      return isAdminRole || normalized === "formador";
    }
    return isAdminRole || normalized === "formador" || normalized === "formacao_financeiro";
  }

  if (
    pathname.startsWith("/meus-cursos") ||
    pathname.startsWith("/pagamentos") ||
    pathname.startsWith("/conquistas") ||
    pathname.startsWith("/loja-cursos")
  ) {
    return isAdminRole || normalized === "formando";
  }

  return true;
}

function isFormacaoRole(value: string): value is FormacaoRole {
  return normalizeRoleForTenant(value, "formacao") !== null || normalizeRoleForTenant(value, "solo_creator") !== null;
}
