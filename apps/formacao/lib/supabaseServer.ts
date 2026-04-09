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
    throw new Error("Missing Supabase env for apps/formacao");
  }

  return { url, anonKey };
}

function resolveCookieOptions() {
  const configuredDomain =
    process.env.KLASSE_COOKIE_DOMAIN?.trim() ||
    process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim() ||
    (process.env.NODE_ENV === "production" ? ".klasse.ao" : "");

  const sameSiteRaw = (
    process.env.KLASSE_COOKIE_SAMESITE ??
    process.env.KLASSE_AUTH_COOKIE_SAMESITE ??
    "lax"
  )
    .trim()
    .toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  return {
    ...(configuredDomain ? { domain: configuredDomain } : {}),
    path: "/",
    sameSite,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function supabaseServer() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: resolveCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(_cookies: { name: string; value: string; options: CookieOptions }[]) {},
    },
  });
}
