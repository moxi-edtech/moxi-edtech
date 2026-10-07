import { NextResponse } from "next/server";
import { appendExpireResponseCookie } from "@moxi/auth-middleware";

export const dynamic = "force-dynamic";

function getSupabaseStorageKey() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!url) return null;

  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

function cookieNamesFromRequest(request: Request) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0]?.trim())
    .filter(Boolean) as string[];
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const storageKey = getSupabaseStorageKey();

  const names = new Set<string>([
    "klasse_ctx",
    ...cookieNamesFromRequest(request).filter(
      (name) => name === "klasse_ctx" || name.startsWith("sb-")
    ),
  ]);

  if (storageKey) {
    names.add(storageKey);
    names.add(`${storageKey}-code-verifier`);
    for (let index = 0; index < 8; index += 1) {
      names.add(`${storageKey}.${index}`);
    }
  }

  const response = NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );

  const domains = new Set<string>();
  for (const candidate of [
    process.env.KLASSE_COOKIE_DOMAIN?.trim(),
    process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
    requestUrl.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : null,
  ]) {
    if (candidate) domains.add(candidate);
  }

  for (const name of names) {
    appendExpireResponseCookie(response, name);
    for (const domain of domains) {
      appendExpireResponseCookie(response, name, domain);
    }
  }

  console.info(
    JSON.stringify({
      event: "web_logout_cookies_cleared",
      route: "/api/auth/logout",
      timestamp: new Date().toISOString(),
      cookie_count: names.size,
      domains: Array.from(domains),
    })
  );

  return response;
}
