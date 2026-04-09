"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function resolveCookieOptions() {
  const domain =
    process.env.NEXT_PUBLIC_KLASSE_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_DOMAIN?.trim() ||
    (typeof window !== "undefined" && window.location.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : "");
  const sameSiteRaw = (process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_SAMESITE ?? "lax").trim().toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite,
    secure,
  };
}

export function createClient() {
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for apps/auth");
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: resolveCookieOptions(),
  });
}
