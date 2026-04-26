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

  if (normalizedTenant === "solo_creator") {
    if (["mentor", "formador", "solo_admin", "creator"].includes(normalizedRole)) {
      return "solo_admin";
    }
  }

  if (normalizedRole === "mentor") return "formador";

  if (
    [
      "formacao_admin",
      "formacao_secretaria",
      "formacao_financeiro",
      "formador",
      "formando",
      "solo_admin",
      "super_admin",
      "global_admin",
    ].includes(normalizedRole)
  ) {
    return normalizedRole as CanonicalFormacaoRole;
  }

  return null;
}

