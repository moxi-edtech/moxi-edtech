import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectProductContextFromHostname, normalizeTenantType } from "@moxi/tenant-sdk";
import { logAuthEvent } from "@/lib/auth-log";
import {
  buildProductRedirectUrl,
  createMiddlewareSupabaseClient,
  resolveDbAuthContext,
  type DbAuthContext,
} from "@moxi/auth-middleware";

type TenantType = "k12" | "formacao";

type AuthContext = {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  tenantType: TenantType | null;
  hasSession: boolean;
};

const UNIVERSAL_LOGIN_URL = process.env.KLASSE_AUTH_URL ?? "https://auth.klasse.ao/login";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/formacao",
  "/agenda",
  "/honorarios",
  "/financeiro",
  "/secretaria",
  "/admin",
  "/meus-cursos",
  "/pagamentos",
  "/conquistas",
  "/loja-cursos",
];

const ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["formacao_admin", "super_admin", "global_admin"] },
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
  const supabase = createSupabaseClient(request, response);
  if (!supabase) return { userId: null, tenantId: null, role: null, tenantType: null, hasSession: false };
  const resolved = await resolveDbAuthContext({
    supabase,
    preferredTenantType: "formacao",
  });

  return {
    userId: resolved.userId,
    tenantId: resolved.tenantId,
    role: resolved.role,
    tenantType: resolved.tenantType as TenantType | null,
    hasSession: resolved.hasSession,
  };
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getDefaultPathByRole(role: string | null): string {
  switch (role) {
    case "formacao_admin":
    case "super_admin":
    case "global_admin":
      return "/admin/dashboard";
    case "formacao_secretaria":
      return "/secretaria/catalogo-cursos";
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
  if (productContext === "formacao") {
    const loginUrl = new URL(UNIVERSAL_LOGIN_URL);
    loginUrl.searchParams.set("redirect", request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  // Local/dev fallback: stay in this app's /login to avoid cross-app redirect loops.
  const localLogin = request.nextUrl.clone();
  localLogin.pathname = "/login";
  localLogin.searchParams.set("redirect", request.nextUrl.href);
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }
  return NextResponse.redirect(localLogin);
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const productContext = detectProductContextFromHostname(request.headers.get("host"));
  const response = NextResponse.next();

  if (productContext === "k12") {
    const redirectUrl = buildProductRedirectUrl({
      requestUrl: request.nextUrl,
      targetProduct: "formacao",
      pathname,
      localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://localhost:3000",
      localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://localhost:3001",
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
      logAuthEvent({
        action: "resolve_context_failed",
        route: pathname,
        details: { reason: "no_session" },
      });
      return redirectWithCookies(response, redirectToLogin(request, productContext));
    }
    if (auth.tenantType === "k12") {
      const redirectUrl = buildProductRedirectUrl({
        requestUrl: request.nextUrl,
        targetProduct: "k12",
        pathname: request.nextUrl.pathname,
        localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://localhost:3000",
        localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://localhost:3001",
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

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultPathByRole(auth.role);
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
    if (auth.tenantType === "k12") {
      const redirectUrl = buildProductRedirectUrl({
        requestUrl: request.nextUrl,
        targetProduct: "k12",
        pathname: request.nextUrl.pathname,
        localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://localhost:3000",
        localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://localhost:3001",
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

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultPathByRole(auth.role);
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

  if (!auth.hasSession) {
    logAuthEvent({
      action: "resolve_context_failed",
      route: pathname,
      details: { reason: "protected_path_without_session" },
    });
    return redirectWithCookies(response, redirectToLogin(request, productContext));
  }

  if (auth.tenantType === "k12") {
    const redirectUrl = buildProductRedirectUrl({
      requestUrl: request.nextUrl,
      targetProduct: "k12",
      pathname: request.nextUrl.pathname,
      localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? "http://localhost:3000",
      localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? "http://localhost:3001",
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

  for (const rule of ROLE_RULES) {
    if (pathname.startsWith(rule.prefix) && auth.role && !rule.roles.includes(String(auth.role))) {
      logAuthEvent({
        action: "deny",
        route: pathname,
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        tenant_type: auth.tenantType,
        details: { reason: "role_mismatch", required_prefix: rule.prefix, role: auth.role },
      });
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/forbidden";
      deniedUrl.searchParams.set("next", pathname);
      return redirectWithCookies(response, NextResponse.redirect(deniedUrl));
    }
  }

  if (pathname === "/dashboard") {
    const target = getDefaultPathByRole(auth.role);
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
