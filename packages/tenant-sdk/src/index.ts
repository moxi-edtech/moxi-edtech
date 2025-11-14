import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type TenantTables = {
  [TableName in keyof Database["public"]["Tables"]]: "escola_id" extends keyof Database["public"]["Tables"][TableName]["Row"]
    ? TableName
    : never;
}[keyof Database["public"]["Tables"]];

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
  escolaId: string
) {
  if (!escolaId) {
    throw new Error("[tenant-sdk] Missing escolaId when scoping query to tenant");
  }
  return client.from(table).eq("escola_id", escolaId);
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
  const { data, error } = await scopeToTenant(client, "escola_configuracoes", escolaId)
    .select("*")
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
