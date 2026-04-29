import { supabaseServer } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

type TenantType = "k12" | "formacao" | "solo_creator";

type EscolaUserRow = Database["public"]["Tables"]["escola_users"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type MembershipRow = Pick<EscolaUserRow, "escola_id" | "papel" | "tenant_type" | "created_at"> & {
  escola:
    | Pick<Database["public"]["Tables"]["escolas"]["Row"], "nome" | "slug" | "tenant_type">
    | Pick<Database["public"]["Tables"]["escolas"]["Row"], "nome" | "slug" | "tenant_type">[]
    | null;
};

function normalizeEscolaRelation(
  escola: MembershipRow["escola"]
): Pick<Database["public"]["Tables"]["escolas"]["Row"], "nome" | "slug" | "tenant_type"> | null {
  if (!escola) return null;
  return Array.isArray(escola) ? escola[0] ?? null : escola;
}

export type FormacaoSessionContext = {
  userId: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantType: TenantType | null;
  role: string | null;
  displayName: string | null;
};

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao" || normalized === "solo_creator") return normalized;
  return null;
}

function chooseMembership(
  memberships: MembershipRow[],
  currentEscolaId: string | null,
  preferredProduct: TenantType | null = null
): MembershipRow | null {
  if (memberships.length === 0) return null;

  if (currentEscolaId) {
    const current = memberships.find((row) => row.escola_id === currentEscolaId);
    if (current) return current;
  }

  if (preferredProduct) {
    const preferred = memberships.find(
      (row) => normalizeTenantType(row.tenant_type ?? normalizeEscolaRelation(row.escola)?.tenant_type) === preferredProduct
    );
    if (preferred) return preferred;
  }

  return memberships[0] ?? null;
}

export async function resolveFormacaoSessionContext(): Promise<FormacaoSessionContext | null> {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return null;

  const { data: membershipsRaw } = await supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,created_at,escola:escolas(nome,slug,tenant_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const memberships = (membershipsRaw ?? []) as MembershipRow[];

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("role,current_escola_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const profile = ((profilesRaw ?? [])[0] ?? null) as Pick<ProfileRow, "role" | "current_escola_id"> | null;

  const selectedMembership = chooseMembership(memberships, profile?.current_escola_id ?? null, null);
  const fallbackEscolaId = selectedMembership?.escola_id ?? profile?.current_escola_id ?? null;

  const fallbackEscola =
    !selectedMembership && fallbackEscolaId
      ? await supabase
          .from("escolas")
          .select("nome,slug,tenant_type")
          .eq("id", fallbackEscolaId)
          .maybeSingle()
      : { data: null };

  const selectedEscola = normalizeEscolaRelation(selectedMembership?.escola ?? null) ?? fallbackEscola.data ?? null;

  // Priority: 1. Membership Role (Specific to this school) | 2. Profile Role (Global fallback)
  const roleFromMembership = selectedMembership?.papel ? String(selectedMembership.papel).trim().toLowerCase() : null;
  const roleFromProfile = profile?.role ? String(profile.role).trim().toLowerCase() : null;

  const resolvedRole = roleFromMembership || roleFromProfile || null;
  const resolvedTenantType = normalizeTenantType(selectedMembership?.tenant_type) ?? normalizeTenantType(selectedEscola?.tenant_type);

  return {
    userId: user.id,
    tenantId: fallbackEscolaId,
    tenantSlug: String(selectedEscola?.slug ?? "").trim() || null,
    tenantName: String(selectedEscola?.nome ?? "").trim() || null,
    tenantType: resolvedTenantType,
    role: resolvedRole,
    displayName:
      String(
        user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          ""
      ).trim() || null,
  };
}
