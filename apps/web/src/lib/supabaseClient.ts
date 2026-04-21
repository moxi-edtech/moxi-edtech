"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  console.error(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidos. " +
      "Verifique as variáveis de ambiente em apps/web/.env.local (dev) ou no ambiente de produção."
  );
}

function resolveCookieOptions() {
  const domain =
    process.env.NEXT_PUBLIC_KLASSE_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_DOMAIN?.trim() ||
    (typeof window !== "undefined" && window.location.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : "");

  const sameSiteRaw = (
    process.env.NEXT_PUBLIC_KLASSE_COOKIE_SAMESITE ??
    process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_SAMESITE ??
    "lax"
  )
    .trim()
    .toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  };
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
