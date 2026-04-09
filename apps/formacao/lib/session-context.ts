import { supabaseServer } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

type TenantType = "k12" | "formacao";

type EscolaUserRow = Database["public"]["Tables"]["escola_users"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type MembershipRow = Pick<EscolaUserRow, "escola_id" | "papel" | "tenant_type" | "created_at"> & {
  escola:
    | Pick<Database["public"]["Tables"]["escolas"]["Row"], "slug" | "tenant_type">
    | Pick<Database["public"]["Tables"]["escolas"]["Row"], "slug" | "tenant_type">[]
    | null;
};

function normalizeEscolaRelation(
  escola: MembershipRow["escola"]
): Pick<Database["public"]["Tables"]["escolas"]["Row"], "slug" | "tenant_type"> | null {
  if (!escola) return null;
  return Array.isArray(escola) ? escola[0] ?? null : escola;
}

export type FormacaoSessionContext = {
  userId: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantType: TenantType | null;
  role: string | null;
};

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao") return normalized;
  return null;
}

function chooseMembership(
  memberships: MembershipRow[],
  currentEscolaId: string | null,
  preferredProduct: TenantType = "formacao"
): MembershipRow | null {
  if (memberships.length === 0) return null;

  const preferred = memberships.find(
    (row) => normalizeTenantType(row.tenant_type ?? normalizeEscolaRelation(row.escola)?.tenant_type) === preferredProduct
  );
  if (preferred) return preferred;

  if (currentEscolaId) {
    const current = memberships.find((row) => row.escola_id === currentEscolaId);
    if (current) return current;
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
    .select("escola_id,papel,tenant_type,created_at,escola:escolas(slug,tenant_type)")
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

  const selectedMembership = chooseMembership(memberships, profile?.current_escola_id ?? null, "formacao");
  const roleFromMembership = selectedMembership?.papel?.trim().toLowerCase() ?? null;
  const roleFromProfile = String(profile?.role ?? "")
    .trim()
    .toLowerCase();

  return {
    userId: user.id,
    tenantId: selectedMembership?.escola_id ?? null,
    tenantSlug: normalizeEscolaRelation(selectedMembership?.escola ?? null)?.slug ?? null,
    tenantType:
      normalizeTenantType(selectedMembership?.tenant_type) ??
      normalizeTenantType(normalizeEscolaRelation(selectedMembership?.escola ?? null)?.tenant_type),
    role: roleFromMembership ?? (roleFromProfile || null),
  };
}
