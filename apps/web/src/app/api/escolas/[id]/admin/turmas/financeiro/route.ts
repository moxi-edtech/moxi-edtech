import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../permissions";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const userEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const turmaIdsParam = searchParams.get("turma_ids") ?? "";
    const turmaIds = Array.from(
      new Set(
        turmaIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => UUID_REGEX.test(id))
      )
    ).slice(0, 50);

    const { data: anoLetivo } = await (supabase as any)
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", userEscolaId)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!anoLetivo?.ano || turmaIds.length === 0) {
      return NextResponse.json({ ok: true, ano_letivo: anoLetivo?.ano ?? null, items: [] });
    }

    const { data: rows, error } = await (supabase as any)
      .from("vw_financeiro_propinas_por_turma")
      .select("turma_id, qtd_mensalidades, qtd_em_atraso, inadimplencia_pct")
      .eq("escola_id", userEscolaId)
      .eq("ano_letivo", anoLetivo.ano)
      .in("turma_id", turmaIds);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (rows ?? []).map((row: any) => ({
      turmaId: row.turma_id,
      qtdMensalidades: Number(row.qtd_mensalidades ?? 0),
      qtdEmAtraso: Number(row.qtd_em_atraso ?? 0),
      inadimplenciaPct: Number(row.inadimplencia_pct ?? 0),
    }));

    return NextResponse.json({ ok: true, ano_letivo: anoLetivo.ano, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
