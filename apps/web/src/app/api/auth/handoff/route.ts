import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createSupabaseDebugFetch,
  logSupabaseCookieSnapshot,
  resolveSharedCookieOptions,
} from "@moxi/auth-middleware";
import { decodeSessionHandoffPayload } from "@/lib/auth/sessionHandoff";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

function expireCookie(response: NextResponse, name: string, domain?: string) {
  response.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    ...(domain ? { domain } : {}),
  });
}

function clearExistingAuthCookies(request: Request, response: NextResponse) {
  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieNames = Array.from(
    new Set(
      cookieHeader
        .split(";")
        .map((part) => part.trim().split("=")[0]?.trim())
        .filter(Boolean) as string[]
    )
  );

  const domainCandidates = Array.from(
    new Set(
      [
        process.env.KLASSE_COOKIE_DOMAIN?.trim(),
        process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
        requestUrl.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : null,
      ].filter(Boolean) as string[]
    )
  );

  for (const name of cookieNames) {
    if (!name.startsWith("sb-")) continue;
    expireCookie(response, name);
    for (const domain of domainCandidates) {
      expireCookie(response, name, domain);
    }
  }
}

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env for auth handoff");
  }

  return { url, anonKey };
}

function buildFreshHandoffClient(request: Request, response: NextResponse) {
  const { url, anonKey } = getSupabaseEnv();
  const requestUrl = new URL(request.url);
  const requestCookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split("=");
      return { name: name?.trim() ?? "", value: rest.join("=") };
    })
    .filter((cookie) => cookie.name);
  logSupabaseCookieSnapshot({
    label: "web_handoff_client",
    requestPath: requestUrl.pathname,
    cookies: requestCookies,
  });
  const cookieOptions = resolveSharedCookieOptions({
    nodeEnv: process.env.NODE_ENV,
    domainEnv: process.env.KLASSE_COOKIE_DOMAIN || process.env.KLASSE_AUTH_COOKIE_DOMAIN,
    sameSiteEnv: process.env.KLASSE_COOKIE_SAMESITE || process.env.KLASSE_AUTH_COOKIE_SAMESITE,
    browserHostname: requestUrl.hostname,
    isHttps: requestUrl.protocol === "https:",
  });

  return createServerClient<Database>(url, anonKey, {
    cookieOptions,
    global: {
      fetch: createSupabaseDebugFetch({
        label: "web_handoff_client",
        requestPath: requestUrl.pathname,
        cookies: requestCookies,
      }),
    },
    cookies: {
      // Critical: ignore incoming cookies so stale app session state cannot poison handoff.
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

function logHandoffEvent(event: string, details: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      event,
      route: "/api/auth/handoff",
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

async function resolvePayload(request: Request) {
  const requestUrl = new URL(request.url);
  const queryPayload = requestUrl.searchParams.get("payload");
  if (queryPayload) {
    return queryPayload;
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    return String(formData.get("payload") ?? "");
  }

  return "";
}

async function handleHandoff(request: Request) {
  const rawPayload = await resolvePayload(request);
  const payload = decodeSessionHandoffPayload(rawPayload);
  const fallback = new URL("/auth-recover?next=/redirect", request.url);

  if (!payload) {
    logHandoffEvent("session_handoff_invalid_payload", {
      method: request.method,
      has_query_payload: new URL(request.url).searchParams.has("payload"),
      has_cookie_header: Boolean(request.headers.get("cookie")),
    });
    return NextResponse.redirect(fallback);
  }

  let destination: URL;
  try {
    destination = new URL(payload.destination);
  } catch {
    logHandoffEvent("session_handoff_invalid_destination", {
      method: request.method,
      destination: payload.destination,
    });
    return NextResponse.redirect(fallback);
  }

  const requestUrl = new URL(request.url);
  if (destination.origin !== requestUrl.origin) {
    logHandoffEvent("session_handoff_origin_mismatch", {
      method: request.method,
      destination_origin: destination.origin,
      request_origin: requestUrl.origin,
    });
    return NextResponse.redirect(fallback);
  }

  const baseResponse = NextResponse.next();
  clearExistingAuthCookies(request, baseResponse);
  const supabase = buildFreshHandoffClient(request, baseResponse);
  const handoffRefreshTokenHash = await globalThis.crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(payload.refresh_token))
    .then((digest) =>
      Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 12)
    );
  logHandoffEvent("session_handoff_payload", {
    method: request.method,
    destination: destination.pathname,
    refresh_token_hash: handoffRefreshTokenHash,
    source: "session_handoff",
  });

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error) {
    logHandoffEvent("session_handoff_set_session_failed", {
      method: request.method,
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    const failed = NextResponse.redirect(fallback);
    clearExistingAuthCookies(request, failed);
    return failed;
  }

  logHandoffEvent("session_handoff_set_session_ok", {
    method: request.method,
    destination: destination.pathname,
  });
  const redirectResponse = NextResponse.redirect(destination);
  baseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}

export async function GET(request: Request) {
  return handleHandoff(request);
}

export async function POST(request: Request) {
  return handleHandoff(request);
}
