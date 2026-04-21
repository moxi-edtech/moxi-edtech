import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { readEnv } from "@/lib/env";

function getSupabaseEnv() {
  const url = readEnv(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = readEnv(process.env.SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env for apps/auth");
  }
  if (url.includes("YOUR-PROJECT-REF") || anonKey.includes("YOUR_PUBLIC_ANON_KEY")) {
    throw new Error("Invalid Supabase env placeholder values for apps/auth");
  }
  try {
    // Validate malformed envs early (for example quoted strings with escapes).
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error("Invalid Supabase URL env for apps/auth");
  }

  return { url, anonKey };
}

function resolveCookieOptions() {
  const localOrigin = readEnv(process.env.KLASSE_AUTH_LOCAL_ORIGIN, "").toLowerCase();
  const inferredDevDomain = localOrigin.includes(".localhost")
    ? ".localhost"
    : localOrigin.includes(".lvh.me")
      ? ".lvh.me"
      : ".lvh.me";
  const domain =
    readEnv(process.env.KLASSE_COOKIE_DOMAIN, process.env.KLASSE_AUTH_COOKIE_DOMAIN) ||
    (process.env.NODE_ENV === "production" ? ".klasse.ao" : inferredDevDomain);
  const sameSiteRaw = readEnv(process.env.KLASSE_AUTH_COOKIE_SAMESITE, "lax").toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";
  const secure = process.env.NODE_ENV === "production";

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite,
    secure,
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

export async function supabaseRouteClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: resolveCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}
