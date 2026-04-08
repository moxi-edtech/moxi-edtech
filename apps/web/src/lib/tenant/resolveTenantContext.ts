import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { Database } from "~types/supabase";
import {
  detectProductContextFromHostname,
  resolveTenantContext,
  type TenantResolverResult,
} from "@moxi/tenant-sdk";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export type UnifiedTenantContext = TenantResolverResult;

export async function resolveTenantContextForUser(params: {
  client: SupabaseClient<Database>;
  userId: string;
  requestedTenantId?: string | null;
  requestedTenantSlug?: string | null;
}): Promise<UnifiedTenantContext | null> {
  const requestHeaders = await headers();
  const productContext = detectProductContextFromHostname(requestHeaders.get("host"));
  return resolveTenantContext({
    client: params.client,
    userId: params.userId,
    productContext,
    requestedTenantId: params.requestedTenantId,
    requestedTenantSlug: params.requestedTenantSlug,
  });
}

export async function resolveTenantContextForRequest(): Promise<UnifiedTenantContext | null> {
  const supabase = await supabaseServerTyped<Database>();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return null;

  return resolveTenantContextForUser({
    client: supabase as unknown as SupabaseClient<Database>,
    userId: user.id,
    requestedTenantId:
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ??
      (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ??
      null,
  });
}
