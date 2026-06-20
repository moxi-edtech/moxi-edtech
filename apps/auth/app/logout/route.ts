import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { clearTenantContextCookie } from "@/lib/tenantContextCookie";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function resolveLoginUrl(request: Request, next: string | null) {
  const base =
    process.env.NODE_ENV === "production"
      ? readEnv(process.env.KLASSE_AUTH_URL, "https://auth.klasse.ao/login")
      : readEnv(process.env.KLASSE_AUTH_LOCAL_URL, "http://auth.lvh.me:3000/login");

  const url = new URL(base, request.url);
  if (next) url.searchParams.set("redirect", next);
  return url;
}

function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && (name.includes("auth-token") || name.includes("access-token") || name.includes("refresh-token"));
}

function expireCookie(response: NextResponse, name: string, domain?: string) {
  response.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(domain ? { domain } : {}),
  });
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const next = reqUrl.searchParams.get("next");
  const response = NextResponse.redirect(resolveLoginUrl(request, next));

  try {
    const supabase = await supabaseRouteClient();
    await supabase.auth.signOut();
  } catch {
    // Best-effort cleanup.
  }

  try {
    await clearTenantContextCookie();
  } catch {
    // Best-effort cleanup.
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieNames = Array.from(
    new Set(
      cookieHeader
        .split(";")
        .map((part) => part.trim().split("=")[0]?.trim())
        .filter(Boolean) as string[]
    )
  );

  const domain =
    readEnv(process.env.KLASSE_COOKIE_DOMAIN, process.env.KLASSE_AUTH_COOKIE_DOMAIN) ||
    (process.env.NODE_ENV === "production" ? ".klasse.ao" : ".lvh.me");

  for (const name of cookieNames) {
    if (name === "klasse_ctx" || isSupabaseAuthCookie(name)) {
      expireCookie(response, name);
      if (domain) expireCookie(response, name, domain);
    }
  }

  return response;
}
