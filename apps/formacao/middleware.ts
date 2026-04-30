import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectProductContextFromHostname } from "@moxi/tenant-sdk";
import { logAuthEvent } from "@/lib/auth-log";
import {
  isCriticalTenantMappingMismatch,
  mapTenantTypeFromDb,
  shouldRedirectToK12FromFormacaoApp,
} from "@/lib/navigation-engine";
import { normalizeRoleForTenant } from "@/lib/role-semantics";
import { decideProductAccess } from "@/lib/product-access";
import {
  buildProductRedirectUrl,
  createMiddlewareSupabaseClient,
  resolveDbAuthContext,
  type DbAuthContext,
} from "@moxi/auth-middleware";

type TenantType = "k12" | "formacao" | "solo_creator";

type AuthContext = {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  tenantType: TenantType | null;
  hasSession: boolean;
};

const CONTEXT_MISMATCH_WINDOW_MS = 5 * 60 * 1000;
const CONTEXT_MISMATCH_THRESHOLD = Number(process.env.KLASSE_CONTEXT_MAPPING_ALERT_THRESHOLD ?? "1");
let contextMismatchTimestamps: number[] = [];

function resolveUniversalLoginUrl() {
  if (process.env.NODE_ENV !== "production") {
    return process.env.KLASSE_AUTH_LOCAL_URL ?? "http://auth.lvh.me:3000/login";
  }

  const configured = process.env.KLASSE_AUTH_URL?.trim();
  if (!configured) {
    throw new Error("Missing KLASSE_AUTH_URL in production");
  }
  return configured;
}

const UNIVERSAL_LOGIN_URL = resolveUniversalLoginUrl();
const TENANT_CONTEXT_COOKIE = "klasse_ctx";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/formacao",
  "/agenda",
  "/mentor",
  "/honorarios",
  "/financeiro",
  "/secretaria",
  "/secretaria/inscricoes",
  "/admin",
  "/meus-cursos",
  "/pagamentos",
  "/conquistas",
  "/loja-cursos",
];

const ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin/publicacao", roles: ["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/admin", roles: ["formacao_admin", "super_admin", "global_admin"] },
  {
    prefix: "/secretaria/inscricoes",
    roles: ["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/secretaria",
    roles: ["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/financeiro",
    roles: ["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/agenda",
    roles: ["formador", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/honorarios",
    roles: ["formador", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/meus-cursos",
    roles: ["formando", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/pagamentos",
    roles: ["formando", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/conquistas",
    roles: ["formando", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    prefix: "/loja-cursos",
    roles: ["formando", "formacao_admin", "super_admin", "global_admin"],
  },
];

const PRODUCT_RULES: Array<{ prefix: string; allowedTenantTypes: Array<"CENTER" | "K12" | "SOLO_CREATOR"> }> = [
  { prefix: "/admin", allowedTenantTypes: ["CENTER", "K12"] },
  { prefix: "/secretaria", allowedTenantTypes: ["CENTER", "K12"] },
  { prefix: "/financeiro", allowedTenantTypes: ["CENTER", "K12"] },
];

type TenantContextCookiePayload = {
  uid: string;
  tenant_id: string;
  tenant_type: TenantType;
  role: string;
  exp: number;
};

function resolveTenantContextCookieSecret() {
  return (
    process.env.KLASSE_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.AUTH_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.AUTH_ADMIN_JOB_TOKEN?.trim() ||
    "dev-only-klasse-context-secret"
  );
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signTenantContextPayload(payloadEncoded: string): Promise<string | null> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return null;
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(resolveTenantContextCookieSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await cryptoApi.subtle.sign("HMAC", key, new TextEncoder().encode(payloadEncoded));
  return bytesToBase64Url(new Uint8Array(signature));
}

function hasLikelySupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name.startsWith("sb-") &&
        (name.includes("auth-token") || name.includes("access-token") || name.includes("refresh-token"))
    );
}

async function resolveAuthContextFromTenantCookie(request: NextRequest): Promise<AuthContext | null> {
  const raw = request.cookies.get(TENANT_CONTEXT_COOKIE)?.value;
  if (!raw || !hasLikelySupabaseSessionCookie(request)) return null;

  const [payloadEncoded, signature] = raw.split(".");
  if (!payloadEncoded || !signature) return null;

  const expectedSignature = await signTenantContextPayload(payloadEncoded);
  if (!expectedSignature || expectedSignature !== signature) return null;

  try {
    const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadEncoded));
    const payload = JSON.parse(payloadJson) as TenantContextCookiePayload;
    const tenantType = String(payload.tenant_type ?? "").trim().toLowerCase();
    const normalizedTenantType =
      tenantType === "k12" || tenantType === "formacao" || tenantType === "solo_creator"
        ? (tenantType as TenantType)
        : null;

    if (!payload.uid || !payload.tenant_id || !normalizedTenantType || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    const normalizedRole = normalizeRoleForTenant(payload.role, normalizedTenantType);
    if (!normalizedRole) return null;

    return {
      userId: payload.uid,
      tenantId: payload.tenant_id,
      role: normalizedRole,
      tenantType: normalizedTenantType,
      hasSession: true,
    };
  } catch {
    return null;
  }
}

function createSupabaseClient(request: NextRequest, response: NextResponse) {
  return createMiddlewareSupabaseClient({
    request,
    response,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieDomain: process.env.KLASSE_COOKIE_DOMAIN?.trim() || process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
    cookieSameSite: process.env.KLASSE_COOKIE_SAMESITE ?? process.env.KLASSE_AUTH_COOKIE_SAMESITE ?? "lax",
    nodeEnv: process.env.NODE_ENV,
  });
}

async function resolveAuthContext(request: NextRequest, response: NextResponse): Promise<AuthContext> {
  const cookieContext = await resolveAuthContextFromTenantCookie(request);
  if (cookieContext) return cookieContext;

  const supabase = createSupabaseClient(request, response);
  if (!supabase) return { userId: null, tenantId: null, role: null, tenantType: null, hasSession: false };
  const resolved = await resolveDbAuthContext({
    supabase,
    preferredTenantType: null,
  });

  const normalizedRole = normalizeRoleForTenant(
    resolved.role,
    (resolved.tenantType as TenantType | null) ?? null
  );

  return {
    userId: resolved.userId,
    tenantId: resolved.tenantId,
    role: normalizedRole,
    tenantType: resolved.tenantType as TenantType | null,
    hasSession: resolved.hasSession,
  };
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function emitContextObservability(auth: AuthContext, route: string) {
  const tenantFromDb = String(auth.tenantType ?? "").trim().toLowerCase() || null;
  const mappedType = mapTenantTypeFromDb(auth.tenantType);
  const role = String(auth.role ?? "").trim().toLowerCase() || null;

  console.info(
    JSON.stringify({
      event: "context_mapping",
      tenant_from_db: tenantFromDb,
      mapped_type: mappedType,
      role,
      route,
      timestamp: new Date().toISOString(),
    })
  );

  if (isCriticalTenantMappingMismatch(tenantFromDb, mappedType)) {
    const now = Date.now();
    contextMismatchTimestamps.push(now);
    contextMismatchTimestamps = contextMismatchTimestamps.filter(
      (ts) => now - ts <= CONTEXT_MISMATCH_WINDOW_MS
    );
    const mismatchCount = contextMismatchTimestamps.length;

    console.error(
      JSON.stringify({
        event: "context_mapping_alert",
        severity: "critical",
        reason: "tenant_mapping_mismatch",
        tenant_from_db: tenantFromDb,
        mapped_type: mappedType,
        role,
        route,
        timestamp: new Date().toISOString(),
      })
    );

    console.warn(
      JSON.stringify({
        event: "context_mapping_metric",
        metric_name: "tenant_mapping_mismatch_total_window",
        window_ms: CONTEXT_MISMATCH_WINDOW_MS,
        count: mismatchCount,
        threshold: CONTEXT_MISMATCH_THRESHOLD,
        route,
        timestamp: new Date().toISOString(),
      })
    );

    if (mismatchCount >= CONTEXT_MISMATCH_THRESHOLD) {
      console.error(
        JSON.stringify({
          event: "context_mapping_paging_alert",
          severity: "critical",
          reason: "tenant_mapping_mismatch_threshold_reached",
          count: mismatchCount,
          threshold: CONTEXT_MISMATCH_THRESHOLD,
          window_ms: CONTEXT_MISMATCH_WINDOW_MS,
          route,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

async function isFormandoPortalBlocked(request: NextRequest, response: NextResponse, auth: AuthContext) {
  if (!auth.hasSession || auth.role !== "formando" || !auth.userId || !auth.tenantId) return false;

  const supabase = createSupabaseClient(request, response);
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("formacao_inscricoes")
    .select("id")
    .eq("escola_id", auth.tenantId)
    .eq("formando_user_id", auth.userId)
    .is("cancelled_at", null)
    .contains("metadata", { portal_access_blocked: true })
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

function getDefaultPathByRole(role: string | null, tenantType: TenantType | null): string {
  const normalizedTenantType = String(tenantType ?? "").trim().toLowerCase();
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  if (normalizedTenantType === "solo_creator") {
    return "/forbidden";
  }
  switch (normalizedRole) {
    case "formacao_admin":
    case "super_admin":
    case "global_admin":
      return "/admin/dashboard";
    case "formacao_secretaria":
      return "/secretaria/turmas";
    case "formacao_financeiro":
      return "/financeiro/dashboard";
    case "formador":
      return "/agenda";
    case "formando":
      return "/meus-cursos";
    default:
      return "/dashboard";
  }
}

function redirectToLogin(request: NextRequest, productContext: ReturnType<typeof detectProductContextFromHostname>) {
  void productContext;
  const loginUrl = new URL(UNIVERSAL_LOGIN_URL);
  const canonicalReturnTo =
    process.env.NODE_ENV !== "production"
      ? new URL(
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
          process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002"
        ).toString()
      : request.nextUrl.href;
  loginUrl.searchParams.set("redirect", canonicalReturnTo);
  return NextResponse.redirect(loginUrl);
}

function applyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
}

function redirectWithCookies(source: NextResponse, target: NextResponse) {
  applyResponseCookies(source, target);
  return target;
}

function redirectToBlocked(request: NextRequest) {
  const blockedUrl = request.nextUrl.clone();
  blockedUrl.pathname = "/acesso-bloqueado";
  blockedUrl.search = "";
  return blockedUrl;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (
    process.env.NODE_ENV !== "production" &&
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.endsWith(".localhost"))
  ) {
    const canonicalOrigin = (process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002").trim();
    try {
      const canonical = new URL(canonicalOrigin);
      if (canonical.host && canonical.host !== host) {
        const next = request.nextUrl.clone();
        next.protocol = canonical.protocol;
        next.hostname = canonical.hostname;
        next.port = canonical.port;
        return NextResponse.redirect(next, 307);
      }
    } catch {
      // ignore invalid canonical origin and continue normal flow
    }
  }

  const { pathname } = request.nextUrl;
  const productContext = detectProductContextFromHostname(request.headers.get("host"));
  const response = NextResponse.next();

  if (productContext === "k12") {
    const redirectUrl = buildProductRedirectUrl({
      requestUrl: request.nextUrl,
      targetProduct: "formacao",
      pathname,
      localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://app.lvh.me:3001",
      localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002",
    });
    logAuthEvent({
      action: "redirect",
      route: pathname,
      details: { reason: "k12_host_accessing_formacao_app", target_product: "formacao" },
    });
    return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (pathname === "/") {
    const auth = await resolveAuthContext(request, response);
    if (!auth.hasSession) {
      console.info(
        JSON.stringify({
          event: "redirect_decision",
          path: pathname,
          hasSession: false,
          timestamp: new Date().toISOString(),
        })
      );
      logAuthEvent({
        action: "resolve_context_failed",
        route: pathname,
        details: { reason: "no_session" },
      });
      return redirectWithCookies(response, redirectToLogin(request, productContext));
    }
    emitContextObservability(auth, pathname);
    if (shouldRedirectToK12FromFormacaoApp(auth.tenantType)) {
      const redirectUrl = buildProductRedirectUrl({
        requestUrl: request.nextUrl,
        targetProduct: "k12",
        pathname: request.nextUrl.pathname,
        localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://app.lvh.me:3001",
        localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002",
      });
      logAuthEvent({
        action: "redirect",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "tenant_type_mismatch", target_product: "k12" },
      });
      return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
    }
    if (auth.tenantType === "solo_creator") {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "solo_creator_not_supported_in_formacao_centro" },
      });
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/forbidden";
      deniedUrl.searchParams.set("next", pathname);
      return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
    }

    if (await isFormandoPortalBlocked(request, response, auth)) {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "portal_access_blocked" },
      });
      return redirectWithCookies(response, NextResponse.redirect(redirectToBlocked(request)));
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultPathByRole(auth.role, auth.tenantType);
    redirectUrl.search = "";
    logAuthEvent({
      action: "redirect",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: { reason: "root_to_default_dashboard" },
    });
    return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (pathname === "/login") {
    // In local/dev we keep /login always reachable to prevent stale-cookie redirect loops.
    if (productContext !== "formacao") {
      return NextResponse.next();
    }

    const auth = await resolveAuthContext(request, response);
    if (!auth.hasSession) {
      console.info(
        JSON.stringify({
          event: "redirect_decision",
          path: pathname,
          hasSession: false,
          timestamp: new Date().toISOString(),
        })
      );
      if (productContext === "formacao") {
        logAuthEvent({
          action: "resolve_context_failed",
          route: pathname,
          details: { reason: "login_without_session" },
        });
        return redirectWithCookies(response, redirectToLogin(request, productContext));
      }
      return NextResponse.next();
    }
    emitContextObservability(auth, pathname);
    if (shouldRedirectToK12FromFormacaoApp(auth.tenantType)) {
      const redirectUrl = buildProductRedirectUrl({
        requestUrl: request.nextUrl,
        targetProduct: "k12",
        pathname: request.nextUrl.pathname,
        localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://app.lvh.me:3001",
        localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002",
      });
      logAuthEvent({
        action: "redirect",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "login_tenant_mismatch", target_product: "k12" },
      });
      return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
    }
    if (auth.tenantType === "solo_creator") {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "solo_creator_not_supported_in_formacao_centro" },
      });
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/forbidden";
      deniedUrl.searchParams.set("next", pathname);
      return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
    }

    if (await isFormandoPortalBlocked(request, response, auth)) {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "portal_access_blocked_on_login" },
      });
      return redirectWithCookies(response, NextResponse.redirect(redirectToBlocked(request)));
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultPathByRole(auth.role, auth.tenantType);
    redirectUrl.search = "";
    logAuthEvent({
      action: "redirect",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: { reason: "login_to_default_dashboard" },
    });
    return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (!isProtectedPath(pathname)) return response;

  const auth = await resolveAuthContext(request, response);
  const normalizedRole = String(auth.role ?? "").trim().toLowerCase();

  if (!auth.hasSession) {
    console.info(
      JSON.stringify({
        event: "redirect_decision",
        path: pathname,
        hasSession: false,
        timestamp: new Date().toISOString(),
      })
    );
    logAuthEvent({
      action: "resolve_context_failed",
      route: pathname,
      details: { reason: "protected_path_without_session" },
    });
    return redirectWithCookies(response, redirectToLogin(request, productContext));
  }
  emitContextObservability(auth, pathname);

  if (shouldRedirectToK12FromFormacaoApp(auth.tenantType)) {
    const redirectUrl = buildProductRedirectUrl({
      requestUrl: request.nextUrl,
      targetProduct: "k12",
      pathname: request.nextUrl.pathname,
      localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://app.lvh.me:3001",
      localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://formacao.lvh.me:3002",
    });
    logAuthEvent({
      action: "redirect",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: { reason: "protected_path_tenant_mismatch", target_product: "k12" },
    });
    return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
  }
  if (auth.tenantType === "solo_creator") {
    logAuthEvent({
      action: "deny",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: { reason: "solo_creator_not_supported_in_formacao_centro" },
    });
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/forbidden";
    deniedUrl.searchParams.set("next", pathname);
    return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
  }

  if (await isFormandoPortalBlocked(request, response, auth)) {
    logAuthEvent({
      action: "deny",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: { reason: "portal_access_blocked_protected_path" },
    });
    return redirectWithCookies(response, NextResponse.redirect(redirectToBlocked(request)));
  }

  const mappedTenantType = mapTenantTypeFromDb(auth.tenantType);
  const productAccessDecision = decideProductAccess(mappedTenantType, pathname);

  if (productAccessDecision.action === "deny") {
    logAuthEvent({
      action: "deny",
      route: pathname,
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      tenant_type: auth.tenantType,
      details: {
        reason: productAccessDecision.reason,
        mapped_tenant_type: mappedTenantType,
      },
    });
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/forbidden";
    deniedUrl.searchParams.set("next", pathname);
    return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
  }

  for (const rule of PRODUCT_RULES) {
    if (pathname.startsWith(rule.prefix) && !rule.allowedTenantTypes.includes(mappedTenantType)) {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: {
          reason: "product_mismatch",
          required_prefix: rule.prefix,
          required_tenant_types: rule.allowedTenantTypes,
          mapped_tenant_type: mappedTenantType,
        },
      });
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/forbidden";
      deniedUrl.searchParams.set("next", pathname);
      return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
    }
  }

  // Sort rules by prefix length (descending) to match most specific first
  const sortedRules = [...ROLE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

  for (const rule of sortedRules) {
    if (pathname.startsWith(rule.prefix)) {
      const isAllowed = rule.roles.some(r => r.toLowerCase() === normalizedRole);
      if (normalizedRole && !isAllowed) {
        logAuthEvent({
          action: "deny",
          route: pathname,
          user_id: auth.userId,
          tenant_id: auth.tenantId,
          tenant_type: auth.tenantType,
          details: { reason: "role_mismatch", required_prefix: rule.prefix, role: normalizedRole, allowed: rule.roles },
        });
        const deniedUrl = request.nextUrl.clone();
        deniedUrl.pathname = "/forbidden";
        deniedUrl.searchParams.set("next", pathname);
        return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
      }
      // If matched this specific rule and allowed, stop checking other (more general) rules
      break;
    }
  }

  if (pathname === "/dashboard") {
    const target = getDefaultPathByRole(auth.role, auth.tenantType);
    if (target !== "/dashboard") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = target;
      return redirectWithCookies(response, NextResponse.redirect(redirectUrl));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/formacao/:path*",
    "/agenda/:path*",
    "/mentor/:path*",
    "/honorarios/:path*",
    "/financeiro/:path*",
    "/secretaria/:path*",
    "/admin/:path*",
    "/meus-cursos/:path*",
    "/pagamentos/:path*",
    "/conquistas/:path*",
    "/loja-cursos/:path*",
  ],
};
