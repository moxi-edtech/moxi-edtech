import type { Database } from "~types/supabase";
import { mapPapelToGlobalRole, normalizePapel } from "@/lib/permissions";
import { allowedPapeisSet } from "@/lib/roles";

type EscolaUserPapel = Exclude<
  Database["public"]["Tables"]["escola_users"]["Insert"]["papel"],
  null | undefined
>;

type ProfileRole = Database["public"]["Enums"]["user_role"];

const LEGACY_PAPEL_MAP: Record<string, EscolaUserPapel> = {
  diretor: "admin_escola",
  administrador: "admin",
  secretario: "secretaria",
  coordenador: "admin_escola",
};

export function normalizeSuperAdminPapelEscolaInput(
  papel: string | null | undefined
): EscolaUserPapel | null {
  if (!papel) return null;

  const normalized = papel.trim().toLowerCase();
  if (!normalized) return null;

  return LEGACY_PAPEL_MAP[normalized] ?? (normalized as EscolaUserPapel);
}

export function deriveSuperAdminSchoolRoleAssignment(input: {
  role?: string | null;
  papelEscola?: string | null;
}): {
  papel: EscolaUserPapel | null;
  profileRole: ProfileRole | null;
} {
  const normalizedRole = normalizeSuperAdminPapelEscolaInput(input.role);
  const normalizedPapel = normalizeSuperAdminPapelEscolaInput(input.papelEscola);

  const papel =
    normalizedPapel ??
    (normalizedRole && allowedPapeisSet.has(normalizedRole) ? normalizedRole : null);

  if (!papel) {
    return { papel: null, profileRole: null };
  }

  if (!allowedPapeisSet.has(papel)) {
    return { papel: null, profileRole: null };
  }

  const normalizedGlobalRole = mapPapelToGlobalRole(normalizePapel(papel));
  return {
    papel,
    profileRole: normalizedGlobalRole as ProfileRole,
  };
}
