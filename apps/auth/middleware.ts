import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { readEnv } from "@/lib/env";

const LOGIN_PATH = "/login";
const PUBLIC_ASSET_PATTERN = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?)$/i;

function resolveAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  // Permite subdomínios klasse.ao e ambientes locais de desenvolvimento
  if (
    origin.endsWith(".klasse.ao") ||
    origin.startsWith("http://app.lvh.me:") ||
    origin.startsWith("http://formacao.lvh.me:") ||
    origin.startsWith("http://auth.lvh.me:") ||
    origin.startsWith("http://localhost:")
  ) {
    return origin;
  }
  return null;
}

function applyCorsHeaders(response: NextResponse, allowedOrigin: string | null) {
  if (!allowedOrigin) return;
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-middleware-prefetch, x-nextjs-data, x-middleware-next"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
}

function applyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
}

function buildSupabaseClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = readEnv(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = readEnv(process.env.SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const errorParam = request.nextUrl.searchParams.get("error");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const allowedOrigin = resolveAllowedOrigin(request);

  // Responde imediatamente a pedidos de preflight (OPTIONS)
  if (request.method === "OPTIONS" && allowedOrigin) {
    const response = new NextResponse(null, { status: 204 });
    applyCorsHeaders(response, allowedOrigin);
    return response;
  }

  if (process.env.NODE_ENV !== "production" && (host.includes("localhost") || host.includes("127.0.0.1"))) {
    const canonicalHost = (process.env.KLASSE_AUTH_LOCAL_ORIGIN ?? "http://auth.lvh.me:3000")
      .trim()
      .toLowerCase();
    try {
      const canonical = new URL(canonicalHost);
      if (canonical.host && canonical.host !== host) {
        const next = request.nextUrl.clone();
        next.protocol = canonical.protocol;
        next.hostname = canonical.hostname;
        next.port = canonical.port;
        const redirectResponse = NextResponse.redirect(next, 307);
        applyCorsHeaders(redirectResponse, allowedOrigin);
        return redirectResponse;
      }
    } catch {
      // ignore invalid canonical origin and continue normal flow
    }
  }

  const response = NextResponse.next();
  applyCorsHeaders(response, allowedOrigin);

  let hasSession = false;
  try {
    const supabase = buildSupabaseClient(request, response);
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      hasSession = Boolean(data.user);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "auth_middleware_error",
        path: pathname,
        hasSession: false,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
    );
  }

  const isPublicAsset = PUBLIC_ASSET_PATTERN.test(pathname) || pathname.startsWith("/_next/");
  const publicWhenNoSession = pathname === LOGIN_PATH || pathname.startsWith("/api/auth/") || isPublicAsset;

  if (!hasSession && !publicWhenNoSession) {
    console.info(
      JSON.stringify({
        event: "access_denied",
        path: pathname,
        hasSession,
        timestamp: new Date().toISOString(),
      })
    );
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", request.nextUrl.href);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyResponseCookies(response, redirectResponse);
    applyCorsHeaders(redirectResponse, allowedOrigin);
    return redirectResponse;
  }

  const allowLoginWithSession =
    pathname === LOGIN_PATH &&
    (errorParam === "no_tenant" || errorParam === "invalid_tenant" || errorParam === "context");

  if (hasSession && pathname === LOGIN_PATH && !allowLoginWithSession) {
    console.info(
      JSON.stringify({
        event: "redirect_decision",
        path: pathname,
        hasSession,
        timestamp: new Date().toISOString(),
      })
    );
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/redirect";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    applyResponseCookies(response, redirectResponse);
    applyCorsHeaders(redirectResponse, allowedOrigin);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
