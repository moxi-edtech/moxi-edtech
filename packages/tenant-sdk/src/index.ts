import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase";

type Tables = Database["public"]["Tables"];
type TenantTableCandidates = {
  [TableName in keyof Tables]: "escola_id" extends keyof Tables[TableName]["Row"] ? TableName : never;
}[keyof Tables];

type TenantTables = Extract<TenantTableCandidates, string>;
type EscolaIdValue<TableName extends TenantTables> = NonNullable<
  Tables[TableName]["Row"]["escola_id"]
>;
type FromReturn = ReturnType<SupabaseClient<Database>["from"]>;

type TenantConfigRow = Database["public"]["Tables"]["escola_configuracoes"]["Row"];

const tenantConfigCache = new Map<string, TenantConfigRow | null>();

function resolveServiceRoleEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `[tenant-sdk] Missing environment variables: ${missing.join(", ")}. ` +
        "Configure them before using the tenant SDK."
    );
  }

  return { url, serviceRoleKey } as { url: string; serviceRoleKey: string };
}

export function createServiceRoleClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = resolveServiceRoleEnv();

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

export function scopeToTenant<TableName extends TenantTables>(
  client: SupabaseClient<Database>,
  table: TableName,
  escolaId: EscolaIdValue<TableName>
): FromReturn {
  if (!escolaId) {
    throw new Error("[tenant-sdk] Missing escolaId when scoping query to tenant");
  }
  const query = client.from(table);
  return (query as unknown as {
    eq: (column: string, value: EscolaIdValue<TableName>) => FromReturn;
  }).eq("escola_id", escolaId);
}

type TenantConfigOptions = {
  client?: SupabaseClient<Database>;
  refresh?: boolean;
};

export async function getTenantConfig(
  escolaId: string,
  options: TenantConfigOptions = {}
): Promise<TenantConfigRow | null> {
  if (!escolaId) {
    throw new Error("[tenant-sdk] escolaId is required to load tenant configuration");
  }

  if (!options.refresh && tenantConfigCache.has(escolaId)) {
    return tenantConfigCache.get(escolaId) ?? null;
  }

  const client = options.client ?? createServiceRoleClient();
  const schoolConfigClient = client as unknown as SupabaseClient<Record<string, never>>;
  const { data, error } = await schoolConfigClient
    .from("escola_configuracoes")
    .select("*")
    .eq("escola_id", escolaId)
    .returns<TenantConfigRow[]>()
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`[tenant-sdk] Failed to load tenant config for ${escolaId}: ${error.message}`);
  }

  tenantConfigCache.set(escolaId, data ?? null);
  return data ?? null;
}

export function invalidateTenantConfig(escolaId: string) {
  if (escolaId) {
    tenantConfigCache.delete(escolaId);
  }
}

export function clearTenantConfigCache() {
  tenantConfigCache.clear();
}

export type TenantType = "k12" | "formacao";
export type ProductContext = "k12" | "formacao" | "landing" | "unknown";

export type TenantResolverResult = {
  tenant_id: string;
  tenant_slug: string | null;
  tenant_type: TenantType;
  user_role: string;
  product_context: ProductContext;
};

export type ResolveTenantContextParams = {
  client: SupabaseClient<Database>;
  userId: string;
  productContext: ProductContext;
  requestedTenantId?: string | null;
  requestedTenantSlug?: string | null;
};

const FORMACAO_ROLE_SET = new Set<string>([
  "formacao_admin",
  "formacao_secretaria",
  "formacao_financeiro",
  "formador",
  "formando",
]);

const K12_ROLE_SET = new Set<string>([
  "admin",
  "staff_admin",
  "admin_escola",
  "secretaria",
  "secretaria_financeiro",
  "admin_financeiro",
  "financeiro",
  "professor",
  "aluno",
  "encarregado",
]);

export function detectProductContextFromHostname(hostname: string | null | undefined): ProductContext {
  const normalized = String(hostname ?? "")
    .trim()
    .toLowerCase()
    .split(":")[0];

  if (!normalized) return "unknown";
  if (normalized === "formacao.klasse.ao") return "formacao";
  if (normalized === "app.klasse.ao") return "k12";
  if (normalized === "klasse.ao" || normalized === "www.klasse.ao") return "landing";
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return "unknown";
  return "unknown";
}

export function normalizeTenantType(value: unknown): TenantType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "k12") return "k12";
  if (normalized === "formacao") return "formacao";
  return null;
}

export function inferTenantTypeFromRole(role: string | null | undefined): TenantType | null {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  if (!normalizedRole) return null;
  if (FORMACAO_ROLE_SET.has(normalizedRole)) return "formacao";
  if (K12_ROLE_SET.has(normalizedRole)) return "k12";
  return null;
}

export function isRoleAllowedForProduct(role: string | null | undefined, product: ProductContext): boolean {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  if (!normalizedRole) return false;
  if (product === "k12") return K12_ROLE_SET.has(normalizedRole) || normalizedRole === "super_admin";
  if (product === "formacao") return FORMACAO_ROLE_SET.has(normalizedRole) || normalizedRole === "super_admin";
  return true;
}

export async function resolveTenantContext(
  params: ResolveTenantContextParams
): Promise<TenantResolverResult | null> {
  const { client, userId, productContext, requestedTenantId, requestedTenantSlug } = params;

  const { data: memberships, error: membershipError } = await client
    .from("escola_users")
    .select("escola_id, papel, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (membershipError || !memberships || memberships.length === 0) return null;

  const escolaIds = Array.from(new Set(memberships.map((item) => String(item.escola_id))));

  const schoolClient = client as unknown as SupabaseClient<Record<string, never>>;
  const { data: escolas, error: escolasError } = await schoolClient
    .from("escolas")
    .select("id, slug, tenant_type")
    .in("id", escolaIds);

  if (escolasError || !escolas || escolas.length === 0) return null;

  const escolaRows = (Array.isArray(escolas) ? escolas : []) as unknown[];
  const escolaById = new Map<
    string,
    { id: string; slug: string | null; tenant_type?: string | null }
  >(
    escolaRows.map((raw) => {
      const item = raw as Record<string, unknown>;
      const id = String(item.id ?? "");
      const slug = typeof item.slug === "string" ? item.slug : null;
      const tenantType = typeof item.tenant_type === "string" ? item.tenant_type : null;
      return [id, { id, slug, tenant_type: tenantType }];
    })
  );

  const wantedSlug = requestedTenantSlug?.trim().toLowerCase() || null;

  const selectedMembership = memberships.find((membership) => {
    if (requestedTenantId && String(membership.escola_id) !== String(requestedTenantId)) return false;
    const escola = escolaById.get(String(membership.escola_id));
    if (!escola) return false;
    if (wantedSlug && String(escola.slug ?? "").toLowerCase() !== wantedSlug) return false;
    return true;
  });

  const activeMembership = selectedMembership ?? memberships[0];
  const activeEscola = escolaById.get(String(activeMembership.escola_id));
  if (!activeEscola) return null;

  const userRole = String(activeMembership.papel ?? "").trim().toLowerCase();
  if (!userRole) return null;

  const tenantType =
    normalizeTenantType(activeEscola.tenant_type) ??
    inferTenantTypeFromRole(userRole) ??
    "k12";

  return {
    tenant_id: String(activeEscola.id),
    tenant_slug: activeEscola.slug ? String(activeEscola.slug) : null,
    tenant_type: tenantType,
    user_role: userRole,
    product_context: productContext,
  };
}
