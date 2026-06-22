import { NextResponse } from "next/server";
import { resolveSharedCookieOptions } from "@moxi/auth-middleware";
import { decodeSessionHandoffPayload } from "@/lib/auth/sessionHandoff";

export const dynamic = "force-dynamic";

const SUPABASE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const SUPABASE_COOKIE_BASE64_PREFIX = "base64-";
const SUPABASE_COOKIE_CHUNK_SIZE = 3180;

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

function getSupabaseUrl() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!url) {
    throw new Error("Missing Supabase env for auth handoff");
  }
  return url;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeJwtExpiry(accessToken: string) {
  const [, payloadEncoded] = accessToken.split(".");
  if (!payloadEncoded) {
    throw new Error("Invalid access token payload");
  }

  const normalized = payloadEncoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const payload = JSON.parse(Buffer.from(`${normalized}${pad}`, "base64").toString("utf8")) as {
    exp?: number;
  };

  if (!payload.exp || !Number.isFinite(payload.exp)) {
    throw new Error("Access token missing exp");
  }

  return payload.exp;
}

function createCookieChunks(name: string, value: string) {
  const encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= SUPABASE_COOKIE_CHUNK_SIZE) {
    return [{ name, value }];
  }

  const chunks: string[] = [];
  let remaining = encodedValue;

  while (remaining.length > 0) {
    let encodedChunkHead = remaining.slice(0, SUPABASE_COOKIE_CHUNK_SIZE);
    const lastEscapePos = encodedChunkHead.lastIndexOf("%");
    if (lastEscapePos > SUPABASE_COOKIE_CHUNK_SIZE - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }

    let valueHead = "";
    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.slice(-3, -2) === "%" &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
          continue;
        }
        throw error;
      }
    }

    chunks.push(valueHead);
    remaining = remaining.slice(encodedChunkHead.length);
  }

  return chunks.map((chunk, index) => ({
    name: `${name}.${index}`,
    value: chunk,
  }));
}

function getSupabaseStorageKey() {
  return `sb-${new URL(getSupabaseUrl()).hostname.split(".")[0]}-auth-token`;
}

function buildSupabaseCookieOptions(requestUrl: URL) {
  return {
    ...resolveSharedCookieOptions({
      nodeEnv: process.env.NODE_ENV,
      domainEnv: process.env.KLASSE_COOKIE_DOMAIN || process.env.KLASSE_AUTH_COOKIE_DOMAIN,
      sameSiteEnv: process.env.KLASSE_COOKIE_SAMESITE || process.env.KLASSE_AUTH_COOKIE_SAMESITE,
      browserHostname: requestUrl.hostname,
      isHttps: requestUrl.protocol === "https:",
    }),
    maxAge: SUPABASE_COOKIE_MAX_AGE,
  };
}

function writeSupabaseSessionCookies(params: {
  requestUrl: URL;
  response: NextResponse;
  accessToken: string;
  refreshToken: string;
}) {
  const expiresAt = decodeJwtExpiry(params.accessToken);
  const expiresIn = Math.max(expiresAt - Math.floor(Date.now() / 1000), 0);
  const storageKey = getSupabaseStorageKey();
  const sessionPayload = JSON.stringify({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    expires_at: expiresAt,
    expires_in: expiresIn,
    token_type: "bearer",
  });
  const encodedPayload = `${SUPABASE_COOKIE_BASE64_PREFIX}${toBase64Url(sessionPayload)}`;
  const cookieOptions = buildSupabaseCookieOptions(params.requestUrl);
  const chunks = createCookieChunks(storageKey, encodedPayload);

  chunks.forEach((chunk) => {
    params.response.cookies.set(chunk.name, chunk.value, cookieOptions);
  });

  return {
    expiresAt,
    expiresIn,
    storageKey,
    chunkCount: chunks.length,
  };
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

  let cookieWriteMeta: { expiresAt: number; expiresIn: number; storageKey: string; chunkCount: number };
  try {
    cookieWriteMeta = writeSupabaseSessionCookies({
      requestUrl,
      response: baseResponse,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
    });
  } catch (error) {
    logHandoffEvent("session_handoff_cookie_write_failed", {
      method: request.method,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    const failed = NextResponse.redirect(fallback);
    clearExistingAuthCookies(request, failed);
    return failed;
  }

  logHandoffEvent("session_handoff_cookie_write_ok", {
    method: request.method,
    destination: destination.pathname,
    storage_key: cookieWriteMeta.storageKey,
    expires_at: cookieWriteMeta.expiresAt,
    expires_in: cookieWriteMeta.expiresIn,
    chunk_count: cookieWriteMeta.chunkCount,
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
