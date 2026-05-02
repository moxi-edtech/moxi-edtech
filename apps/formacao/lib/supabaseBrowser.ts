"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

function resolveCookieOptions() {
  const configuredDomain =
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
    ...(configuredDomain ? { domain: configuredDomain } : {}),
    path: "/",
    sameSite,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  };
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase browser client não configurado.");
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: resolveCookieOptions(),
  });
  
  return browserClient;
}
