import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

type TenantType = "k12" | "formacao";
type ProductContext = TenantType;

export type SessionContext = {
  user_id: string;
  tenant_id: string;
  tenant_slug: string | null;
  tenant_type: TenantType;
  user_role: string;
  product_context: ProductContext;
};

export type SessionContextList = {
  user_id: string;
  contexts: SessionContext[];
};

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao") return normalized;
  return null;
}

export async function resolveSessionContexts(): Promise<SessionContextList | null> {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return null;

  const { data: membershipsRaw } = await supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!membershipsRaw || membershipsRaw.length === 0) {
    return { user_id: user.id, contexts: [] };
  }

  const escolaIds = Array.from(new Set(membershipsRaw.map((row) => String(row.escola_id))));
  const { data: escolasRaw } = await supabase
    .from("escolas")
    .select("id,slug,tenant_type")
    .in("id", escolaIds);

  const escolaById = new Map(
    (escolasRaw ?? []).map((escola) => [String(escola.id), { slug: escola.slug, tenant_type: escola.tenant_type }])
  );

  const contexts: SessionContext[] = [];
  const seen = new Set<string>();

  for (const membership of membershipsRaw) {
    const tenantId = String(membership.escola_id ?? "").trim();
    const role = String(membership.papel ?? "")
      .trim()
      .toLowerCase();
    const escola = escolaById.get(tenantId);
    const tenantType = normalizeTenantType(membership.tenant_type ?? escola?.tenant_type ?? null);

    if (!tenantId || !tenantType || !role) continue;
    if (seen.has(tenantId)) continue;

    contexts.push({
      user_id: user.id,
      tenant_id: tenantId,
      tenant_slug: escola?.slug ?? null,
      tenant_type: tenantType,
      user_role: role,
      product_context: tenantType,
    });
    seen.add(tenantId);
  }

  return {
    user_id: user.id,
    contexts,
  };
}

export async function resolveSessionContext(params?: {
  requestedTenantId?: string | null;
  preferredProduct?: ProductContext | null;
}): Promise<SessionContext | null> {
  const list = await resolveSessionContexts();
  if (!list || list.contexts.length === 0) return null;

  const requestedTenantId = String(params?.requestedTenantId ?? "").trim();
  if (requestedTenantId) {
    return list.contexts.find((ctx) => ctx.tenant_id === requestedTenantId) ?? null;
  }

  const preferredProduct = params?.preferredProduct ?? null;
  if (preferredProduct) {
    const preferred = list.contexts.find((ctx) => ctx.tenant_type === preferredProduct);
    if (preferred) return preferred;
  }

  return list.contexts[0] ?? null;
}

