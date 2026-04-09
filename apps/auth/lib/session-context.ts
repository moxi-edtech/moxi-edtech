import "server-only";

import type { Database } from "~types/supabase";
import { supabaseServer } from "@/lib/supabaseServer";

type TenantType = "k12" | "formacao";
type ProductContext = TenantType;

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

export type SessionContext = {
  user_id: string;
  tenant_id: string | null;
  tenant_slug: string | null;
  tenant_type: TenantType | null;
  user_role: string | null;
  product_context: ProductContext | null;
};

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao") return normalized;
  return null;
}

function isFormacaoRole(value: unknown): boolean {
  const role = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    role === "formacao_admin" ||
    role === "formacao_secretaria" ||
    role === "formacao_financeiro" ||
    role === "formador" ||
    role === "formando"
  );
}

function productFromRoleAndTenant(role: string | null, tenantType: TenantType | null): ProductContext | null {
  if (tenantType) return tenantType;
  if (isFormacaoRole(role)) return "formacao";
  if (role === "super_admin" || role === "global_admin") return "k12";
  return null;
}

function chooseMembership(
  memberships: MembershipRow[],
  currentEscolaId: string | null,
  preferredProduct: ProductContext | null
): MembershipRow | null {
  if (memberships.length === 0) return null;

  if (preferredProduct) {
    const preferred = memberships.find(
      (row) => normalizeTenantType(row.tenant_type ?? normalizeEscolaRelation(row.escola)?.tenant_type) === preferredProduct
    );
    if (preferred) return preferred;
  }

  if (currentEscolaId) {
    const current = memberships.find((row) => row.escola_id === currentEscolaId);
    if (current) return current;
  }

  return memberships[0] ?? null;
}

export async function resolveSessionContext(preferredProduct: ProductContext | null = null): Promise<SessionContext | null> {
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

  const selectedMembership = chooseMembership(
    memberships,
    profile?.current_escola_id ?? null,
    preferredProduct
  );

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metadataRole = String(appMetadata.role ?? "").trim().toLowerCase() || null;

  const membershipRole = selectedMembership?.papel?.trim().toLowerCase() ?? null;
  const profileRole = String(profile?.role ?? "").trim().toLowerCase() || null;
  const role = membershipRole ?? profileRole ?? metadataRole;

  const tenantType =
    normalizeTenantType(selectedMembership?.tenant_type) ??
    normalizeTenantType(normalizeEscolaRelation(selectedMembership?.escola ?? null)?.tenant_type);

  const productContext = productFromRoleAndTenant(role, tenantType);

  return {
    user_id: user.id,
    tenant_id: selectedMembership?.escola_id ?? null,
    tenant_slug: normalizeEscolaRelation(selectedMembership?.escola ?? null)?.slug ?? null,
    tenant_type: tenantType,
    user_role: role,
    product_context: productContext,
  };
}
