import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Minimal middleware: gate by presence of Supabase auth cookies only.
// Role-based authorization should be enforced in Server Components and API routes.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Allow Next.js assets and common static files without auth/redirects
  if (
    pathname.startsWith("/_next") || // JS chunks, HMR, fonts, etc.
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/api/_next") || // safety for any nested proxies
    /\.(?:js|mjs|css|json|map|png|jpg|jpeg|gif|svg|ico|webp|avif|txt|woff2?)$/i.test(pathname)
  ) {
    return res;
  }

  // Allow guest onboarding links without auth
  const allowGuestOnboarding = /^\/escola\/[^/]+\/onboarding\/?$/.test(pathname);
  if (allowGuestOnboarding) return res;

  // Heuristic: presence of Supabase auth cookies indicates a session
  const cookies = req.cookies.getAll();
  const hasAuthCookie = cookies.some((c) =>
    c.name === "sb-access-token" ||
    c.name === "sb-refresh-token" ||
    c.name.includes("supabase") ||
    c.name.startsWith("sb-") ||
    c.name.startsWith("sb:")
  );

  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/aluno/:path*",
    "/professor/:path*",
    "/secretaria/:path*",
    "/financeiro/:path*",
    "/escola/:path*",
  ],
};
