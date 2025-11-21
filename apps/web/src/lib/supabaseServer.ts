// apps/web/src/lib/supabaseServer.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  if (!url || !anonKey) {
    const missing: string[] = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    throw new Error(
      `[Supabase] Missing env ${missing.join(", ")}. Set them in apps/web/.env.local or the deploy environment.`
    );
  }

  return { url, anonKey };
}

/**
 * Server-side Supabase client for Server Components / layouts / loaders.
 * Reads cookies (session), does NOT write them (Next 15 only allows that
 * in Route Handlers or Server Actions).
 *
 * Use:
 *   const supabase = await supabaseServer();
 */
export function supabaseServer() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // No-op: writing cookies here causaria "Cookies can only be modified..."
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });
}

/**
 * Generic typed variant for use where you need an augmented Database type.
 * Same behavior: only read cookies.
 *
 * Example (como no /api/escolas/create):
 *   const supabase = await supabaseServerTyped<DBWithRPC>();
 */
export function supabaseServerTyped<TDatabase = Database>() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient<TDatabase>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });
}
