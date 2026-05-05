"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { readEnv } from "@/lib/env";
import { resolveSharedCookieOptions } from "@moxi/auth-middleware";

const url = readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function resolveCookieOptions() {
  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  return resolveSharedCookieOptions({
    nodeEnv: process.env.NODE_ENV,
    domainEnv: readEnv(process.env.NEXT_PUBLIC_KLASSE_COOKIE_DOMAIN, process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_DOMAIN),
    sameSiteEnv: readEnv(process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_SAMESITE, "lax"),
    browserHostname: hostname,
    isHttps,
  });
}

export function createClient() {
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for apps/auth");
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: resolveCookieOptions(),
  });
}
