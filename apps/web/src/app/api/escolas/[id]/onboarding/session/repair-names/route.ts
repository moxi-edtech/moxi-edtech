import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";

// POST /api/escolas/[id]/onboarding/session/repair-names
// Admin-only: Ajusta anos_letivos para o formato canônico (datas coerentes)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    // Authorization: escola admin or vínculo com permissão configurar_escola
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from("escola_users")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      if (!allowed) allowed = !!papel && hasPermission(papel as any, "configurar_escola");
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(
          prof && prof.length > 0 && (prof[0] as any).role === "admin"
        );
      } catch {}
    }
    if (!allowed)
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
      );

    // Load academic years
    const { data: sessions, error } = await (s as any)
      .from("anos_letivos")
      .select("id, ano, data_inicio, data_fim, ativo")
      .eq("escola_id", escolaId);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );

    const toUpdate: Array<{ id: string; data_inicio: string; data_fim: string; ano: number }> = [];
    for (const sRow of (sessions || []) as any[]) {
      const ano = Number(sRow.ano ?? new Date(String(sRow.data_inicio)).getFullYear());
      if (!Number.isFinite(ano)) continue;
      const start = `${ano}-01-01`;
      const end = `${ano + 1}-12-31`;
      if (String(sRow.data_inicio).slice(0, 10) !== start || String(sRow.data_fim).slice(0, 10) !== end) {
        toUpdate.push({ id: sRow.id, data_inicio: start, data_fim: end, ano });
      }
    }

    let updated = 0;
    for (const patch of toUpdate) {
      const { error: updErr } = await (s as any)
        .from("anos_letivos")
        .update({ data_inicio: patch.data_inicio, data_fim: patch.data_fim, ano: patch.ano } as any)
        .eq("id", patch.id);
      if (!updErr) updated++;
    }

    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'ANO_LETIVO_REPAIR_NAMES',
      entity: 'anos_letivos',
      details: { updated, total: (sessions || []).length },
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      escolaId,
      updated,
      total: (sessions || []).length,
      changes: toUpdate,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
