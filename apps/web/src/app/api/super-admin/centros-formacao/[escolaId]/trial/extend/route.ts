import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

async function assertSuperAdmin(s: SupabaseClient) {
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };

  const { data: roles } = await s
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const role = (roles?.[0] as { role?: string } | undefined)?.role;
  if (!isSuperAdminRole(role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function POST(request: Request, context: { params: Promise<{ escolaId: string }> }) {
  try {
    const { escolaId } = await context.params;
    const normalizedEscolaId = String(escolaId || "").trim();
    if (!normalizedEscolaId) {
      return NextResponse.json({ ok: false, error: "escolaId ausente" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { days?: unknown } | null;
    const daysRaw = Number(body?.days ?? 5);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(Math.floor(daysRaw), 30)) : 5;

    const s = (await supabaseServer()) as unknown as SupabaseClient & {
      rpc: (
        fn: "formacao_extend_trial",
        args: { p_escola_id: string; p_days: number }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const { data, error } = await s.rpc("formacao_extend_trial", {
      p_escola_id: normalizedEscolaId,
      p_days: days,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}
