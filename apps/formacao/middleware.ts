import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectProductContextFromHostname, normalizeTenantType } from "@moxi/tenant-sdk";

type TenantType = "k12" | "formacao";

type AuthContext = {
  role: string | null;
  tenantType: TenantType | null;
  hasSession: boolean;
};

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) return null;

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractTokenFromCookies(request: NextRequest): string | null {
  const authCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.includes("auth-token") && cookie.name.startsWith("sb-"));

  if (!authCookie?.value) return null;

  try {
    const decoded = decodeURIComponent(authCookie.value);
    const parsed = JSON.parse(decoded) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    return authCookie.value;
  }

  return authCookie.value;
}

function extractAuthContext(request: NextRequest): AuthContext {
  const token = extractTokenFromCookies(request);
  if (!token) {
    return { role: null, tenantType: null, hasSession: false };
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { role: null, tenantType: null, hasSession: true };
  }

  const appMetadata = (payload.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (payload.user_metadata ?? {}) as Record<string, unknown>;

  const role = String(appMetadata.role ?? userMetadata.role ?? "").trim().toLowerCase() || null;

  const tenantType = normalizeTenantType(
    appMetadata.tenant_type ??
      userMetadata.tenant_type ??
      appMetadata.modelo_ensino ??
      userMetadata.modelo_ensino
  );

  return {
    role,
    tenantType,
    hasSession: true,
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const productContext = detectProductContextFromHostname(request.headers.get("host"));

  if (productContext === "k12") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "formacao.klasse.ao";
    redirectUrl.protocol = "https:";
    redirectUrl.port = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  const auth = extractAuthContext(request);

  if (!auth.hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (auth.tenantType === "k12") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "app.klasse.ao";
    redirectUrl.protocol = "https:";
    redirectUrl.port = "";
    return NextResponse.redirect(redirectUrl);
  }

  for (const rule of ROLE_RULES) {
    if (pathname.startsWith(rule.prefix) && !rule.roles.includes(String(auth.role))) {
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/forbidden";
      deniedUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(deniedUrl);
    }
  }

  if (pathname === "/dashboard") {
    const target = getDefaultPathByRole(auth.role);
    if (target !== "/dashboard") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = target;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
