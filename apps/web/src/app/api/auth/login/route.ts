// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------- Helpers de env (deferidos para tempo de execução) ----------
function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ).trim();
  return { url, anonKey } as const;
}

// Safe helper to inspect anon key payload (no secret leakage)
function parseAnonKeyInfo(key: string | undefined) {
  try {
    if (!key) return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return { ref: json?.ref as string | undefined, role: json?.role as string | undefined };
  } catch {
    return null;
  }
}

// Map common auth errors to user-friendly messages/status
function mapAuthError(err: any): { status: number; message: string } {
  const message = (err?.message || "Credenciais inválidas.") as string;
  const lower = message.toLowerCase();
  const status = Number(err?.status) || 401;

  if (lower.includes("confirm") || lower.includes("not confirmed")) {
    return { status: 403, message: "E-mail não confirmado. Verifique sua caixa de entrada." };
  }
  if (lower.includes("invalid login") || lower.includes("invalid email") || lower.includes("invalid credentials")) {
    return { status: 401, message: "Credenciais inválidas." };
  }
  if (status === 429 || lower.includes("too many") || lower.includes("rate")) {
    return { status: 429, message: "Muitas tentativas. Tente novamente em alguns minutos." };
  }
  return { status: status >= 400 && status < 600 ? status : 401, message };
}

// ---------- Resolver identificador (numero_login / telefone → email) ----------

async function resolveIdentifierToEmail(
  identifier: string
): Promise<string | null> {
  // Se já parece email, não mexe
  if (identifier.includes("@")) return null;

  const adminUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!adminUrl || !serviceRole) {
    return null;
  }

  const admin = createAdminClient<Database>(adminUrl, serviceRole);

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
    const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseEnv();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Server misconfigured: missing Supabase URL or ANON key." }),
        { status: 500, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }

    // Optional debug to verify envs at runtime without leaking secrets
    if (process.env.DEBUG_AUTH === "1") {
      const keyInfo = parseAnonKeyInfo(SUPABASE_ANON_KEY);
      const masked = `${SUPABASE_ANON_KEY.slice(0, 6)}...${SUPABASE_ANON_KEY.slice(-6)}`;
      console.log("[login] Using Supabase env:", {
        urlHost: (() => {
          try { return new URL(SUPABASE_URL).host; } catch { return SUPABASE_URL; }
        })(),
        anonKeyMasked: masked,
        anonKeyRef: keyInfo?.ref,
        anonKeyRole: keyInfo?.role,
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const rawIdentifier = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!rawIdentifier || !password) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Email/usuário e senha são obrigatórios." }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }

    // Se o identificador não é email e não há service role, retorne um erro claro
    const isEmail = rawIdentifier.includes("@");
    const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
    if (!isEmail && !hasServiceRole) {
      if (process.env.DEBUG_AUTH === "1") {
        console.warn("[login] Non-email identifier used but SUPABASE_SERVICE_ROLE_KEY is missing. Identifier:", rawIdentifier);
      }
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error: "Servidor sem chave de serviço para resolver usuário. Use seu e-mail para entrar ou configure SUPABASE_SERVICE_ROLE_KEY.",
        }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }

    console.log('[login] rawIdentifier:', rawIdentifier);
    // Tenta resolver identificador numérico / numero_login / telefone para email
    const translatedEmail = isEmail ? null : await resolveIdentifierToEmail(rawIdentifier);
    console.log('[login] translatedEmail:', translatedEmail);

    if (!isEmail && !translatedEmail) {
      // Não foi possível mapear numero_login/telefone → email
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Credenciais inválidas." }),
        { status: 401, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }
    const email = (translatedEmail || rawIdentifier).toLowerCase();
    console.log('[login] email:', email);

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

    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('[login] signInWithPassword data:', data);
    console.log('[login] signInWithPassword error:', error);

    if (error || !data?.user) {
      const mapped = mapAuthError(error);

      // Em desenvolvimento, se o erro for de e-mail não confirmado,
      // tente confirmar automaticamente e refazer o login.
      const isDev = process.env.NODE_ENV !== "production";
      const adminUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
      const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
      const canAdmin = Boolean(isDev && adminUrl && serviceRole);

      if (canAdmin && (mapped.message?.toLowerCase?.() || "").includes("e-mail não confirmado")) {
        try {
          const admin = createAdminClient<Database>(adminUrl, serviceRole);
          const { data: prof } = await admin
            .from("profiles")
            .select("user_id")
            .eq("email", email)
            .limit(1);
          const uid = (prof?.[0] as any)?.user_id as string | undefined;
          if (uid) {
            try { await (admin as any).auth.admin.updateUserById(uid, { email_confirm: true } as any) } catch {}
            // Retry sign in after confirming
            const retry = await supabase.auth.signInWithPassword({ email, password });
            data = retry.data as any;
            error = retry.error as any;
          }
        } catch (e) {
          // ignore and fall through to error response
        }
      }

      if (error || !data?.user) {
        console.error("[login] signIn error:", { status: mapped.status, message: mapped.message, raw: String(error?.message || error) });
        return new NextResponse(
          JSON.stringify({ ok: false, error: mapped.message }),
          { status: mapped.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
        );
      }
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

      console.log('[login] profile lookup profile:', profile);
      console.log('[login] profile lookup error:', profileError);

      if (!profileError && profile) {
        role = (profile as any)?.role ?? null;
        escola_id = (profile as any)?.escola_id ?? null;
      }
    } catch (e) {
      console.warn("[login] profile lookup failed:", e);
    }

    // Monta resposta final reaproveitando Set-Cookie do cookieCarrier
    // Copia apenas os headers de Set-Cookie do cookieCarrier
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    })
    try {
      const cc: any = cookieCarrier.headers as any;
      const iter = typeof cc?.entries === 'function' ? cc.entries() : [];
      for (const pair of iter as Iterable<[string, string]>) {
        const [key, value] = pair;
        if (typeof key === 'string' && key.toLowerCase() === 'set-cookie') {
          headers.append(key, value);
        }
      }
    } catch {}

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
      { status: 200, headers }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[login] 500 error:", err);
    return new NextResponse(
      JSON.stringify({ ok: false, error: message || "Erro interno no servidor." }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
    );
  }
}
