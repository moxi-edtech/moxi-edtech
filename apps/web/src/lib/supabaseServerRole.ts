// apps/web/src/lib/supabaseServerRole.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

/**
 * Supabase client using SERVICE_ROLE_KEY.
 * USE WITH EXTREME CAUTION: Bypasses ALL RLS policies.
 * Only use in secure server-side logic (Route Handlers / Server Actions)
 * where you explicitly validate the tenant/user context.
 */
export function supabaseServerRole() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure they are set in the environment."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
