import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { readEnv } from "@/lib/env";
import { resolveSharedCookieOptions } from "@moxi/auth-middleware";

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
    // Validate malformed envs early
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error("Invalid Supabase URL env for apps/auth");
  }

  return { url, anonKey };
}

async function resolveCookieOptions() {
  const head = await headers();
  const hostname = head.get("host")?.split(":")[0] || "";
  const isHttps = head.get("x-forwarded-proto") === "https";

  return resolveSharedCookieOptions({
    nodeEnv: process.env.NODE_ENV,
    domainEnv: readEnv(process.env.KLASSE_COOKIE_DOMAIN, process.env.KLASSE_AUTH_COOKIE_DOMAIN),
    sameSiteEnv: readEnv(process.env.KLASSE_AUTH_COOKIE_SAMESITE, "lax"),
    browserHostname: hostname,
    isHttps,
  });
}

export async function supabaseServer() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: await resolveCookieOptions(),
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
    cookieOptions: await resolveCookieOptions(),
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
