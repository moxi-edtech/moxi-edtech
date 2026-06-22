import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase";

export type TenantType = "k12" | "formacao" | "solo_creator";
export type ProductContext = "k12" | "formacao";

type MiddlewareRequestLike = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
  };
  nextUrl: {
    clone: () => URL;
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
  };
};

type MiddlewareResponseLike = {
  cookies: {
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
  };
};

type EscolaMembershipRow = Pick<
  Database["public"]["Tables"]["escola_users"]["Row"],
  "escola_id" | "papel" | "tenant_type" | "created_at"
> & {
  escola: Pick<Database["public"]["Tables"]["escolas"]["Row"], "tenant_type">[] | null;
};

export type DbAuthContext = {
  hasSession: boolean;
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  tenantType: TenantType | null;
};

type AuthCookieLike = {
  name: string;
  value: string;
};

type SupabaseCookieSource = {
  source: string;
  refreshTokenHash: string | null;
};

async function sha256Short(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryDecodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const decoded = atob(`${normalized}${pad}`);
    return decoded;
  } catch {
    return null;
  }
}

function extractRefreshTokenCandidate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const json = safeJsonParse(value);
    if (json) return extractRefreshTokenCandidate(json);

    const decoded = tryDecodeBase64Url(value);
    if (decoded) {
      const decodedJson = safeJsonParse(decoded);
      if (decodedJson) return extractRefreshTokenCandidate(decodedJson);
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractRefreshTokenCandidate(item);
      if (candidate) return candidate;
    }
    return typeof value[1] === "string" ? value[1] : null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.refresh_token === "string") return record.refresh_token;
    if (record.currentSession) return extractRefreshTokenCandidate(record.currentSession);
    if (record.session) return extractRefreshTokenCandidate(record.session);
    if (record.value) return extractRefreshTokenCandidate(record.value);
  }

  return null;
}

function isSupabaseAuthCookieName(name: string) {
  return (
    name.startsWith("sb-") &&
    (name.includes("auth-token") || name.includes("access-token") || name.includes("refresh-token"))
  );
}

function splitSupabaseCookieName(name: string) {
  if (!isSupabaseAuthCookieName(name)) return null;

  const chunkMatch = name.match(/^(.*)\.(\d+)$/);
  if (!chunkMatch) {
    return { baseName: name, chunkIndex: null as number | null };
  }

  return {
    baseName: chunkMatch[1],
    chunkIndex: Number(chunkMatch[2]),
  };
}

export function getSupabaseAuthCookieConflicts(cookies: AuthCookieLike[]) {
  const grouped = new Map<string, { hasBase: boolean; chunkIndexes: number[] }>();

  for (const cookie of cookies) {
    const parts = splitSupabaseCookieName(cookie.name);
    if (!parts) continue;

    const current = grouped.get(parts.baseName) ?? { hasBase: false, chunkIndexes: [] };
    if (parts.chunkIndex === null) {
      current.hasBase = true;
    } else {
      current.chunkIndexes.push(parts.chunkIndex);
    }
    grouped.set(parts.baseName, current);
  }

  return Array.from(grouped.entries())
    .filter(([, value]) => value.hasBase && value.chunkIndexes.length > 0)
    .map(([baseName, value]) => ({
      baseName,
      chunkIndexes: value.chunkIndexes.sort((a, b) => a - b),
    }));
}

export function normalizeSupabaseAuthCookies<T extends AuthCookieLike>(cookies: T[]): T[] {
  const conflictedBaseNames = new Set(
    getSupabaseAuthCookieConflicts(cookies).map((conflict) => conflict.baseName)
  );

  if (conflictedBaseNames.size === 0) {
    return cookies;
  }

  return cookies.filter((cookie) => {
    const parts = splitSupabaseCookieName(cookie.name);
    if (!parts) return true;
    if (!conflictedBaseNames.has(parts.baseName)) return true;
    return parts.chunkIndex !== null;
  });
}

async function describeSupabaseCookieSources(cookies: AuthCookieLike[]): Promise<SupabaseCookieSource[]> {
  const grouped = new Map<string, { baseValue: string | null; chunks: Array<{ index: number; value: string }> }>();

  for (const cookie of cookies) {
    const parts = splitSupabaseCookieName(cookie.name);
    if (!parts) continue;

    const current = grouped.get(parts.baseName) ?? { baseValue: null, chunks: [] };
    if (parts.chunkIndex === null) {
      current.baseValue = cookie.value;
    } else {
      current.chunks.push({ index: parts.chunkIndex, value: cookie.value });
    }
    grouped.set(parts.baseName, current);
  }

  const sources: SupabaseCookieSource[] = [];
  for (const [baseName, value] of grouped.entries()) {
    if (value.baseValue) {
      const refreshToken = extractRefreshTokenCandidate(value.baseValue);
      sources.push({
        source: baseName,
        refreshTokenHash: refreshToken ? await sha256Short(refreshToken) : null,
      });
    }

    if (value.chunks.length > 0) {
      const chunkValue = value.chunks
        .sort((a, b) => a.index - b.index)
        .map((chunk) => chunk.value)
        .join("");
      const refreshToken = extractRefreshTokenCandidate(chunkValue);
      sources.push({
        source: `${baseName}.${value.chunks.map((chunk) => chunk.index).join(".")}`,
        refreshTokenHash: refreshToken ? await sha256Short(refreshToken) : null,
      });
    }
  }

  return sources;
}

export function logSupabaseCookieSnapshot(params: {
  label: string;
  requestPath?: string | null;
  cookies: AuthCookieLike[];
}) {
  void (async () => {
    const conflicts = getSupabaseAuthCookieConflicts(params.cookies);
    const sources = await describeSupabaseCookieSources(params.cookies);
    console.info(
      JSON.stringify({
        event: "supabase_cookie_snapshot",
        label: params.label,
        request_path: params.requestPath ?? null,
        timestamp: new Date().toISOString(),
        cookies: params.cookies.map((cookie) => ({
          name: cookie.name,
          size: cookie.value.length,
          domain: null,
          path: null,
        })),
        conflicts: conflicts.map((conflict) => ({
          base_name: conflict.baseName,
          chunk_indexes: conflict.chunkIndexes,
        })),
        sources,
      })
    );
  })();
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.body && typeof init.body === "string") return init.body;
  if (init?.body instanceof URLSearchParams) return init.body.toString();
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return await input.clone().text();
    } catch {
      return "";
    }
  }
  return "";
}

function extractRefreshTokenFromBody(body: string) {
  if (!body) return { grantType: null as string | null, refreshToken: null as string | null };
  try {
    const params = new URLSearchParams(body);
    return {
      grantType: params.get("grant_type"),
      refreshToken: params.get("refresh_token"),
    };
  } catch {
    return { grantType: null, refreshToken: null };
  }
}

export function createSupabaseDebugFetch(params: {
  label: string;
  requestPath?: string | null;
  cookies: AuthCookieLike[];
}) {
  const baseFetch = globalThis.fetch.bind(globalThis);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");
    if (url.includes("/auth/v1/token") || url.includes("/auth/v1/user")) {
      const body = await readRequestBody(input, init);
      const tokenInfo = extractRefreshTokenFromBody(body);
      console.info(
        JSON.stringify({
          event: "supabase_auth_request",
          label: params.label,
          request_path: params.requestPath ?? null,
          timestamp: new Date().toISOString(),
          method,
          url_path: new URL(url).pathname,
          grant_type: tokenInfo.grantType,
          refresh_token_hash: tokenInfo.refreshToken ? await sha256Short(tokenInfo.refreshToken) : null,
        })
      );
    }

    return baseFetch(input, init);
  };
}

export function resolveSharedCookieOptions(params: {
  nodeEnv: string | undefined;
  domainEnv?: string | null;
  sameSiteEnv?: string | null;
  browserHostname?: string | null;
  isHttps?: boolean;
}) {
  const nodeEnv = String(params.nodeEnv ?? "").trim().toLowerCase();
  const isProduction = nodeEnv === "production";
  const browserHost = String(params.browserHostname ?? "").trim().toLowerCase();
  const isIpAddressHost =
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(browserHost) ||
    /^\[[0-9a-f:]+\]$/i.test(browserHost);
  const isPlainLocalhost = browserHost === "localhost" || browserHost === "127.0.0.1";
  
  // Se estivermos em qualquer subdomínio do klasse.ao, forçamos o uso do domínio wildcard
  const isBrowserHostKlasse = browserHost.endsWith(".klasse.ao") || browserHost === "klasse.ao";

  // Em desenvolvimento, suportamos wildcard para lvh.me e localhost se o host os contiver
  const isLocalWildcard = browserHost.endsWith(".lvh.me") || browserHost.endsWith(".localhost");

  const configuredDomain = isIpAddressHost || isPlainLocalhost ? "" : String(params.domainEnv ?? "").trim();
  let domain = configuredDomain;
  
  if (!domain) {
    if (isBrowserHostKlasse || isProduction) {
      domain = ".klasse.ao";
    } else if (isLocalWildcard) {
      domain = browserHost.endsWith(".lvh.me") ? ".lvh.me" : ".localhost";
    }
  }

  const sameSiteRaw = String(params.sameSiteEnv ?? "lax")
    .trim()
    .toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  // Se estivermos no klasse.ao, forçamos secure true pois usamos HTTPS sempre lá
  const secure = params.isHttps || isProduction || isBrowserHostKlasse;

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite,
    secure,
    httpOnly: false,
  };
}

export function createMiddlewareSupabaseClient(params: {
  request: MiddlewareRequestLike;
  response: MiddlewareResponseLike;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  cookieDomain?: string | null;
  cookieSameSite?: string | null;
  nodeEnv?: string;
}): SupabaseClient<Database> | null {
  const url = String(params.supabaseUrl ?? "").trim();
  const key = String(params.supabaseAnonKey ?? "").trim();
  if (!url || !key) return null;

  const cookieOptions = resolveSharedCookieOptions({
    nodeEnv: params.nodeEnv,
    domainEnv: params.cookieDomain,
    sameSiteEnv: params.cookieSameSite,
    browserHostname: params.request.nextUrl.hostname,
    isHttps: params.request.nextUrl.protocol === "https:",
  });
  const requestCookies = params.request.cookies.getAll();
  logSupabaseCookieSnapshot({
    label: "middleware_supabase_client",
    requestPath: params.request.nextUrl.pathname,
    cookies: requestCookies,
  });

  return createServerClient<Database>(url, key, {
    cookieOptions,
    global: {
      fetch: createSupabaseDebugFetch({
        label: "middleware_supabase_client",
        requestPath: params.request.nextUrl.pathname,
        cookies: requestCookies,
      }),
    },
    cookies: {
      getAll() {
        return normalizeSupabaseAuthCookies(params.request.cookies.getAll());
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          params.response.cookies.set(name, value, options);
        });
      },
    },
  });
}

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao" || normalized === "solo_creator") return normalized;
  return null;
}

function resolveMembershipTenantType(row: EscolaMembershipRow | null): TenantType | null {
  if (!row) return null;
  const escolaTenant = Array.isArray(row.escola) ? row.escola[0]?.tenant_type : null;
  return normalizeTenantType(row.tenant_type ?? escolaTenant ?? null);
}

export async function resolveDbAuthContext(params: {
  supabase: SupabaseClient<Database>;
  preferredTenantType?: TenantType | null;
}): Promise<DbAuthContext> {
  const { data: authRes } = await params.supabase.auth.getUser();
  const user = authRes?.user;
  if (!user) {
    return {
      hasSession: false,
      userId: null,
      tenantId: null,
      role: null,
      tenantType: null,
    };
  }

  const { data: profileRows } = await params.supabase
    .from("profiles")
    .select("current_escola_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentEscolaId = profileRows?.[0]?.current_escola_id ?? null;

  const { data: membershipRows } = await params.supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,created_at,escola:escolas(tenant_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const memberships = (membershipRows ?? []) as unknown as EscolaMembershipRow[];

  const selectedMembership =
    memberships.find((row) => row.escola_id === currentEscolaId) ??
    (params.preferredTenantType
      ? memberships.find((row) => resolveMembershipTenantType(row) === params.preferredTenantType)
      : null) ??
    memberships[0] ??
    null;

  return {
    hasSession: true,
    userId: user.id,
    tenantId: selectedMembership?.escola_id ?? null,
    role: selectedMembership?.papel?.trim().toLowerCase() ?? null,
    tenantType: resolveMembershipTenantType(selectedMembership),
  };
}

export function buildProductRedirectUrl(params: {
  requestUrl: URL;
  targetProduct: ProductContext;
  pathname: string;
  localK12Origin?: string;
  localFormacaoOrigin?: string;
}) {
  const redirectUrl = new URL(params.requestUrl.toString());
  const isLocalRequestHost =
    redirectUrl.hostname === "localhost" ||
    redirectUrl.hostname === "127.0.0.1" ||
    redirectUrl.hostname.endsWith(".localhost");

  if (isLocalRequestHost) {
    const originRaw =
      params.targetProduct === "formacao"
        ? params.localFormacaoOrigin ?? "http://localhost:3001"
        : params.localK12Origin ?? "http://localhost:3000";

    try {
      const origin = new URL(originRaw);
      redirectUrl.protocol = origin.protocol;
      redirectUrl.hostname = origin.hostname;
      redirectUrl.port = origin.port;
    } catch {
      redirectUrl.hostname = params.targetProduct === "formacao" ? "formacao.klasse.ao" : "app.klasse.ao";
    }
  } else {
    redirectUrl.hostname = params.targetProduct === "formacao" ? "formacao.klasse.ao" : "app.klasse.ao";
  }

  redirectUrl.pathname = params.pathname;
  if (redirectUrl.protocol === "http:" && redirectUrl.hostname.endsWith("klasse.ao")) {
    redirectUrl.protocol = "https:";
    redirectUrl.port = "";
  }

  return redirectUrl;
}
