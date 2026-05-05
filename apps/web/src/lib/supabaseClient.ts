"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { resolveSharedCookieOptions } from "@moxi/auth-middleware";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidos. " +
      "Verifique as variáveis de ambiente em apps/web/.env.local (dev) ou no ambiente de produção."
  );
}

function resolveCookieOptions() {
  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  return resolveSharedCookieOptions({
    nodeEnv: process.env.NODE_ENV,
    domainEnv: process.env.NEXT_PUBLIC_KLASSE_COOKIE_DOMAIN || process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_DOMAIN,
    sameSiteEnv: process.env.NEXT_PUBLIC_KLASSE_COOKIE_SAMESITE || process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_SAMESITE,
    browserHostname: hostname,
    isHttps,
  });
}

export const createClient = () => {
  if (!url || !anonKey) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no ambiente."
    );
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: resolveCookieOptions(),
  });
};
