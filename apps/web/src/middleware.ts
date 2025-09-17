import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  // 🔑 Busca sessão server-side
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔎 Pega role do banco de forma resiliente (evita erros de maybeSingle)
  const { data: rows, error: profileError } = await supabase
    .from("profiles")
    .select("role, escola_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (profileError) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const profile = rows?.[0] as { role?: string | null; escola_id?: string | null } | undefined;
  const role: string = profile?.role ?? "guest";
  const pathname = req.nextUrl.pathname;

  // 🚦 Regras de acesso
  if (pathname.startsWith("/super-admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/admin") && !["admin", "super_admin"].includes(role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/professor") && role !== "professor") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/aluno") && role !== "aluno") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/secretaria") && role !== "secretaria") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/financeiro") && role !== "financeiro") {
    return NextResponse.redirect(new URL("/", req.url));
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
  ],
};
