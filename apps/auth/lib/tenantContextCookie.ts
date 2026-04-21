import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { readEnv } from "@/lib/env";

export type TenantContextCookie = {
  uid: string;
  tenant_id: string;
  tenant_slug: string | null;
  tenant_type: "k12" | "formacao";
  role: string;
  iat: number;
  exp: number;
};

const COOKIE_NAME = "klasse_ctx";
const DEFAULT_TTL_SECONDS = 15 * 60;

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, "base64").toString("utf8");
}

function getCookieSecret() {
  return readEnv(
    process.env.KLASSE_CONTEXT_COOKIE_SECRET,
    process.env.AUTH_CONTEXT_COOKIE_SECRET,
    process.env.CRON_SECRET,
    process.env.AUTH_ADMIN_JOB_TOKEN,
    "dev-only-klasse-context-secret"
  );
}

function signPayload(payload: string) {
  return base64UrlEncode(crypto.createHmac("sha256", getCookieSecret()).update(payload).digest());
}

function encodeContext(ctx: TenantContextCookie) {
  const encoded = base64UrlEncode(JSON.stringify(ctx));
  return `${encoded}.${signPayload(encoded)}`;
}

function decodeContext(raw: string): TenantContextCookie | null {
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  if (signPayload(encoded) !== signature) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as TenantContextCookie;
    if (!parsed?.uid || !parsed?.tenant_id || !parsed?.tenant_type || !parsed?.exp) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveCookieOptions(maxAgeSeconds: number) {
  const localOrigin = readEnv(process.env.KLASSE_AUTH_LOCAL_ORIGIN, "").toLowerCase();
  const inferredDevDomain = localOrigin.includes(".localhost")
    ? ".localhost"
    : localOrigin.includes(".lvh.me")
      ? ".lvh.me"
      : ".lvh.me";
  const domain =
    readEnv(process.env.KLASSE_COOKIE_DOMAIN, process.env.KLASSE_AUTH_COOKIE_DOMAIN) ||
    (process.env.NODE_ENV === "production" ? ".klasse.ao" : inferredDevDomain);
  const sameSiteRaw = readEnv(process.env.KLASSE_AUTH_COOKIE_SAMESITE, "lax").toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: maxAgeSeconds,
  } as const;
}

export async function setTenantContextCookie(input: {
  uid: string;
  tenant_id: string;
  tenant_slug?: string | null;
  tenant_type: "k12" | "formacao";
  role: string;
  ttlSeconds?: number;
}) {
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const context: TenantContextCookie = {
    uid: input.uid,
    tenant_id: input.tenant_id,
    tenant_slug: input.tenant_slug ?? null,
    tenant_type: input.tenant_type,
    role: input.role,
    iat: now,
    exp: now + ttlSeconds,
  };

  const store = await cookies();
  store.set(COOKIE_NAME, encodeContext(context), resolveCookieOptions(ttlSeconds));
}

export async function clearTenantContextCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", resolveCookieOptions(0));
}

export async function getTenantContextCookieForUser(userId: string): Promise<TenantContextCookie | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = decodeContext(raw);
  if (!parsed) return null;
  if (parsed.uid !== userId) return null;
  return parsed;
}
