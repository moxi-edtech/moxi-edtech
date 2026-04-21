import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type TenantType = "k12" | "formacao";

export type UserTenant = {
  tenantId: string;
  tenantName: string;
  tenantType: TenantType;
  role: string;
};

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao") return normalized;
  return null;
}

export async function getUserTenants(userId: string): Promise<UserTenant[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,escola:escolas(nome,tenant_type)")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const missingNameIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const tenantId = String(row.escola_id ?? "").trim();
          const escola = row.escola as { nome?: string | null } | null;
          const tenantName = String(escola?.nome ?? "").trim();
          return tenantId && !tenantName ? tenantId : "";
        })
        .filter(Boolean)
    )
  );

  const fallbackNames = new Map<string, string>();
  if (missingNameIds.length > 0) {
    const { data: schools } = await supabase
      .from("escolas")
      .select("id,nome")
      .in("id", missingNameIds);
    for (const school of schools ?? []) {
      const id = String(school.id ?? "").trim();
      const name = String(school.nome ?? "").trim();
      if (id && name) fallbackNames.set(id, name);
    }
  }

  const tenants: UserTenant[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const tenantId = String(row.escola_id ?? "").trim();
    const role = String(row.papel ?? "")
      .trim()
      .toLowerCase();
    const escola = row.escola as { nome?: string | null; tenant_type?: string | null } | null;
    const tenantType = normalizeTenantType(row.tenant_type ?? escola?.tenant_type ?? null);
    const relationName = String(escola?.nome ?? "").trim();
    const fallbackName = fallbackNames.get(tenantId) ?? "";
    const tenantName = (relationName || fallbackName || `Contexto ${String(tenantType ?? "").toUpperCase()}`).trim();

    if (!tenantId || !tenantType || !role || seen.has(tenantId)) continue;
    tenants.push({
      tenantId,
      tenantName,
      tenantType,
      role,
    });
    seen.add(tenantId);
  }

  return tenants;
}

export async function validateUserTenant(
  userId: string,
  tenantIdRaw: unknown
): Promise<UserTenant | null> {
  const tenantId = String(tenantIdRaw ?? "").trim();
  if (!tenantId) return null;

  const tenants = await getUserTenants(userId);
  return tenants.find((tenant) => tenant.tenantId === tenantId) ?? null;
}
