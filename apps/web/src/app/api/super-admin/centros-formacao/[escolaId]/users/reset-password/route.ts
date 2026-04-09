import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { recordAuditServer } from "@/lib/audit";

function generateStrongPassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const all = upper + lower + numbers + symbols;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  let password = pick(upper) + pick(lower) + pick(numbers) + pick(symbols);
  while (password.length < length) {
    password += pick(all);
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export async function POST(request: Request, context: { params: Promise<{ escolaId: string }> }) {
  try {
    const { escolaId } = await context.params;
    const normalizedEscolaId = String(escolaId || "").trim();
    if (!normalizedEscolaId) {
      return NextResponse.json({ ok: false, error: "escolaId ausente" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { userId?: string } | null;
    const userId = String(body?.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId ausente" }, { status: 400 });
    }

    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const { data: sess } = await s.auth.getUser();
    const current = sess?.user;
    if (!current) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: roles } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", current.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (roles?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data: membership, error: membershipError } = await s
      .from("escola_users")
      .select("user_id")
      .eq("escola_id", normalizedEscolaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError) {
      throw membershipError;
    }
    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "Utilizador não pertence à equipa deste centro" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } = await s
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) {
      throw profileError;
    }

    const tempPassword = generateStrongPassword();
    await callAuthAdminJob(request, "updateUserById", {
      userId,
      attributes: {
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
        },
      },
    });

    recordAuditServer({
      escolaId: normalizedEscolaId,
      portal: "super_admin",
      acao: "RESET_PASSWORD_FORCADO",
      entity: "usuario_centro_formacao",
      entityId: userId,
      details: {
        email: profile?.email ?? null,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      userId,
      email: profile?.email ?? null,
      tempPassword,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao redefinir senha",
      },
      { status: 500 }
    );
  }
}

