// apps/web/src/lib/supabaseServer.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

// Resolves env vars once with proper narrowing
const rawUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl || !rawAnonKey) {
  throw new Error("Supabase env vars missing in supabaseServer");
}

const SUPABASE_URL = rawUrl as string;
const SUPABASE_ANON_KEY = rawAnonKey as string;

/**
 * Server-side Supabase client for Server Components / layouts / loaders.
 * Reads cookies (session), does NOT write them (Next 15 only allows that
 * in Route Handlers or Server Actions).
 *
 * Use:
 *   const supabase = await supabaseServer();
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
export async function supabaseServerTyped<TDatabase = Database>() {
  const cookieStore = await cookies();

  return createServerClient<TDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });
}
