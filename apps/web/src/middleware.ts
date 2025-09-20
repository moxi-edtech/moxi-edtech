import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { hasAnyPermission } from "@/lib/permissions";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = req.cookies.get(name)?.value;
          
          // 🔥 CORREÇÃO: Se o cookie começa com base64-, retorne como está
          // Não tente parsear JSON aqui - deixe o Supabase lidar com a decodificação
          if (cookie && cookie.startsWith('base64-')) {
            return cookie;
          }
          
          return cookie;
        },
        set(name: string, value: string, options: CookieOptions) {
          // 🔥 CORREÇÃO: Garantir que o valor seja stringificada corretamente
          const cookieValue = typeof value === 'string' ? value : JSON.stringify(value);
          res.cookies.set(name, cookieValue, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  const pathname = req.nextUrl.pathname;

  // 🔑 Primeiro tenta pegar o usuário validado pelo Supabase Auth server
  let { data: { user } } = await supabase.auth.getUser();

  // 🔄 Fallback: se ainda não tem user validado, mas a sessão existe (logo após login)
  if (!user) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      user = session.user;
    }
  }

  // Permite acesso ao onboarding via magic link antes de autenticação definitiva
  if (!user) {
    const allowGuestOnboarding = /^\/escola\/[^/]+\/onboarding\/?$/.test(pathname);
    if (!allowGuestOnboarding) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // 🔎 Busca role no banco
  const { data: rows, error: profileError } = await supabase
    .from("profiles")
    .select("role, escola_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (profileError) {
    console.error('Erro ao buscar profile:', profileError);
    return NextResponse.redirect(new URL("/", req.url));
  }

  let profile = rows?.[0] as { role?: string | null; escola_id?: string | null } | undefined;
  let role: string = profile?.role ?? "guest";

  // 👉 Se role for admin, mas não é super_admin, reforça pelo vínculo em escola_usuarios
  if (role === "admin") {
    const { data: vinc } = await supabase
      .from("escola_usuarios")
      .select("papel")
      .eq("user_id", user.id)
      .limit(1);

    const papelEscola = vinc?.[0]?.papel;
    if (papelEscola === "admin") {
      role = "admin"; // mantém admin válido
    } else if (!papelEscola) {
      role = "guest"; // força fallback para guest se não tiver vínculo
    }
  }

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

  // 🔒 (resto do código igual ao seu: bloqueio global + secretaria + financeiro + aluno + admin da escola)

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