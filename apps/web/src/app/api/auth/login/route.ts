import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

// Helper: resolve non-email identifiers (numero_login or numeric) to email using service role
async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  // If looks like an email, do not transform
  if (identifier.includes('@')) return null;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Try numero_login format: 3 hex-like chars + 4 digits (e.g., C1D0001)
    const numeroLoginLike = /^[A-F0-9]{3}\d{4}$/i;
    if (numeroLoginLike.test(identifier)) {
      const numero = identifier.toUpperCase();
      const { data, error } = await (admin as any)
        .from('profiles')
        .select('email')
        .eq('numero_login', numero)
        .limit(1);
      if (!error) {
        const email = (data?.[0] as any)?.email as string | undefined;
        if (email) return email;
      }
    }

    // 2) Fallback for legacy numeric-only identifiers
    const onlyDigits = /^\d{5,}$/;
    if (onlyDigits.test(identifier)) {
      // Try numero_login == digits
      const { data: byNumero, error: e1 } = await (admin as any)
        .from('profiles')
        .select('email')
        .eq('numero_login', identifier)
        .limit(1);
      if (!e1) {
        const email = (byNumero?.[0] as any)?.email as string | undefined;
        if (email) return email;
      }

      // Try telefone == digits (older flows)
      const { data: byPhone, error: e2 } = await admin
        .from('profiles')
        .select('email')
        .eq('telefone', identifier)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!e2) {
        const email = (byPhone?.[0] as any)?.email as string | undefined;
        if (email) return email;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentifier = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { ok: false, error: "Email/usuário e senha são obrigatórios." },
        { status: 400 }
      );
    }

    // Allow login by numeric identifier (resolve to email when possible)
    const translatedEmail = await resolveIdentifierToEmail(rawIdentifier);
    const email = (translatedEmail || rawIdentifier).toLowerCase();

    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Credenciais inválidas." },
        { status: 401 }
      );
    }

    // Optionally fetch role/escola for convenience (client still re-checks on /redirect)
    let role: string | null = null;
    let escola_id: string | null = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, escola_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      role = (profile as any)?.role ?? null;
      escola_id = (profile as any)?.escola_id ?? null;
    } catch {
      // ignore profile lookup failure
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        escola_id,
        must_change_password: Boolean((data.user as any)?.user_metadata?.must_change_password),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
