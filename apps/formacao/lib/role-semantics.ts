type TenantType = "k12" | "formacao" | "solo_creator";

export type CanonicalFormacaoRole =
  | "formacao_admin"
  | "formacao_secretaria"
  | "formacao_financeiro"
  | "formador"
  | "formando"
  | "solo_admin"
  | "super_admin"
  | "global_admin";

export function normalizeRoleForTenant(
  roleRaw: string | null | undefined,
  tenantType: TenantType | null | undefined
): CanonicalFormacaoRole | null {
  const normalizedRole = String(roleRaw ?? "").trim().toLowerCase();
  const normalizedTenant = String(tenantType ?? "").trim().toLowerCase();

  if (!normalizedRole) return null;

  // Solo creator isolation
  if (normalizedTenant === "solo_creator") {
    if (["mentor", "formador", "solo_admin", "creator"].includes(normalizedRole)) {
      return "solo_admin";
    }
  }

  // Legacy K12 roles can still exist on older formacao memberships.
  // Normalize them at the product boundary so stale cookies/rows do not
  // collapse to role=null and send valid users to /forbidden.
  if (normalizedTenant === "formacao") {
    if (["admin", "admin_escola", "staff_admin"].includes(normalizedRole)) {
      return "formacao_admin";
    }
    if (["secretaria", "secretaria_financeiro"].includes(normalizedRole)) {
      return "formacao_secretaria";
    }
    if (["financeiro", "admin_financeiro"].includes(normalizedRole)) {
      return "formacao_financeiro";
    }
    if (normalizedRole === "professor") return "formador";
    if (normalizedRole === "aluno" || normalizedRole === "encarregado") return "formando";
  }

  // Mentor/Formador mapping
  if (normalizedRole === "mentor" || normalizedRole === "formador") return "formador";

  // Check against canonical formation roles (Center)
  const formationRoles = [
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "formando"
  ];

  if (formationRoles.includes(normalizedRole)) {
    return normalizedRole as CanonicalFormacaoRole;
  }

  // Global admin fallback
  if (["super_admin", "global_admin"].includes(normalizedRole)) {
    return normalizedRole as CanonicalFormacaoRole;
  }

  return null;
}
