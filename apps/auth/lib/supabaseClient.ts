"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { readEnv } from "@/lib/env";

const url = readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function resolveCookieOptions() {
  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const inferredDevDomain = hostname.endsWith(".localhost")
    ? ".localhost"
    : hostname.endsWith(".lvh.me")
      ? ".lvh.me"
      : "";
  const domain =
    readEnv(process.env.NEXT_PUBLIC_KLASSE_COOKIE_DOMAIN, process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_DOMAIN) ||
    (hostname.endsWith(".klasse.ao") ? ".klasse.ao" : inferredDevDomain);
  const sameSiteRaw = readEnv(process.env.NEXT_PUBLIC_KLASSE_AUTH_COOKIE_SAMESITE, "lax").toLowerCase();
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
