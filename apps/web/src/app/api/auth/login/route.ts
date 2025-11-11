// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

// ---------- Helpers de env (com narrowing explícito) ----------

const rawUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl || !rawAnonKey) {
  throw new Error("Supabase env vars missing in /api/auth/login");
}

const SUPABASE_URL = rawUrl as string;
const SUPABASE_ANON_KEY = rawAnonKey as string;

// ---------- Resolver identificador (numero_login / telefone → email) ----------

async function resolveIdentifierToEmail(
  identifier: string
): Promise<string | null> {
  // Se já parece email, não mexe
  if (identifier.includes("@")) return null;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const admin = createAdminClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1) numero_login tipo C1D0001 (3 hex + 4 dígitos)
    const numeroLoginLike = /^[A-F0-9]{3}\d{4}$/i;
    if (numeroLoginLike.test(identifier)) {
      const numero = identifier.toUpperCase();
      const { data, error } = await admin
        .from("profiles")
        .select("email")
        .eq("numero_login", numero)
        .limit(1);

      if (!error) {
        const email = (data?.[0] as any)?.email as string | undefined;
        if (email) return email.toLowerCase();
      }
    }

    // 2) Legacy: só dígitos
    const onlyDigits = /^\d{5,}$/;
    if (onlyDigits.test(identifier)) {
      // numero_login == digits
      const { data: byNumero, error: e1 } = await admin
        .from("profiles")
        .select("email")
        .eq("numero_login", identifier)
        .limit(1);

      if (!e1) {
        const email = (byNumero?.[0] as any)?.email as string | undefined;
        if (email) return email.toLowerCase();
      }

      // telefone == digits
      const { data: byPhone, error: e2 } = await admin
        .from("profiles")
        .select("email")
        .eq("telefone", identifier)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!e2) {
        const email = (byPhone?.[0] as any)?.email as string | undefined;
        if (email) return email.toLowerCase();
      }
    }

    return null;
  } catch (error) {
    console.error("[login] resolveIdentifierToEmail error:", error);
    return null;
  }
}

// ---------- Handler principal ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const rawIdentifier = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { ok: false, error: "Email/usuário e senha são obrigatórios." },
        { status: 400 }
      );
    }

    // Tenta resolver identificador numérico / numero_login / telefone para email
    const translatedEmail = await resolveIdentifierToEmail(rawIdentifier);
    const email = (translatedEmail || rawIdentifier).toLowerCase();

    // Response "base" apenas para carregar Set-Cookie
    const cookieCarrier = NextResponse.json({ ok: true });

    // Supabase server-side com bridge completo de cookies
    const supabase = createServerClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieCarrier.cookies.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            cookieCarrier.cookies.set(name, "", {
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      console.error("[login] signIn error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error?.message || "Credenciais inválidas.",
        },
        { status: 401 }
      );
    }

    // Carregar dados de perfil básicos
    let role: string | null = null;
    let escola_id: string | null = null;

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, escola_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profileError && profile) {
        role = (profile as any)?.role ?? null;
        escola_id = (profile as any)?.escola_id ?? null;
      }
    } catch (e) {
      console.warn("[login] profile lookup failed:", e);
    }

    // Monta resposta final reaproveitando Set-Cookie do cookieCarrier
    return new NextResponse(
      JSON.stringify({
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
          escola_id,
          must_change_password: Boolean(
            (data.user as any)?.user_metadata?.must_change_password
          ),
        },
      }),
      {
        status: 200,
        headers: cookieCarrier.headers,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[login] 500 error:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
