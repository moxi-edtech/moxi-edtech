// apps/web/src/middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "~types/supabase"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          res.cookies.set(name, value, options)
        },
        remove(name: string, options) {
          res.cookies.set(name, "", { ...options, maxAge: 0 })
        },
      },
    }
  )

  // 1) busca usuário autenticado
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    console.warn("⚠️ Middleware não achou sessão:", error?.message)
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // 2) busca perfil no banco (com tipagem explícita)
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, escola_id")
    .eq("user_id", user.id)
    .single()

  // 3) normaliza valores com tipagem segura
  const role: string = (profileData as { role?: string } | null)?.role ?? "guest"
  const escola_id: string | null = (profileData as { escola_id?: string } | null)?.escola_id ?? null
  const pathname = req.nextUrl.pathname

  console.log("DEBUG middleware user:", { role, escola_id, pathname })

  // 4) regras de acesso
  if (pathname.startsWith("/super-admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (
    pathname.startsWith("/admin") &&
    role !== "admin" &&
    role !== "super_admin"
  ) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (pathname.startsWith("/professor") && role !== "professor") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (pathname.startsWith("/aluno") && role !== "aluno") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (pathname.startsWith("/secretaria") && role !== "secretaria") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (pathname.startsWith("/financeiro") && role !== "financeiro" && role !== "super_admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return res
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
}
