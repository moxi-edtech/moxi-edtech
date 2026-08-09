import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEscolaId = searchParams.get("escolaId") || searchParams.get("escola_id") || null;
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const allYears = searchParams.get("todos") === "1";
    const anoScope = allYears
      ? null
      : await resolveAnoLetivoScope(supabase, escolaId, {
          anoLetivoId: searchParams.get("ano_letivo_id") || searchParams.get("session_id"),
          ano: searchParams.get("ano") ? Number(searchParams.get("ano")) : null,
        });
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), MAX_PAGE_SIZE);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    let itemsQuery = (supabase as any)
      .from("vw_financeiro_mensalidades_reconciliacao_assistida")
      .select(
        "mensalidade_id,aluno_id,aluno_nome,matricula_id,session_id,ano_letivo_id,ano_letivo,matricula_ano_letivo,mensalidade_ano_letivo,mensalidade_turma_id,matricula_turma_id,turma_nome,data_vencimento,mes_referencia,ano_referencia,status,valor_previsto,valor_pago_total,saldo,problemas_abertos,problema_principal,calendario_inicio,calendario_fim",
        { count: "exact" }
      )
      .eq("escola_id", escolaId)
      .order("problema_principal", { ascending: true })
      .order("data_vencimento", { ascending: true })
      .order("mensalidade_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (anoScope?.id) {
      itemsQuery = itemsQuery.eq("ano_letivo_id", anoScope.id);
    }

    const [{ data: items, count, error: itemsError }, summaryRes] = await Promise.all([
      itemsQuery,
      supabase.rpc("get_financeiro_mensalidades_reconciliacao_resumo", {
        p_escola_id: escolaId,
        p_ano_letivo_id: anoScope?.id ?? null,
      } as never),
    ]);

    if (itemsError) {
      return NextResponse.json({ ok: false, error: "Erro ao carregar reconciliação", details: itemsError.message }, { status: 500 });
    }
    if (summaryRes.error) {
      return NextResponse.json({ ok: false, error: "Erro ao resumir reconciliação", details: summaryRes.error.message }, { status: 500 });
    }

    const summary = (summaryRes.data ?? []).map((row: any) => ({
      problema: String(row.problema),
      total: Number(row.total ?? 0),
      saldo: Number(row.saldo ?? 0),
    }));

    return NextResponse.json({
      ok: true,
      escolaId,
      anoLetivoId: anoScope?.id ?? null,
      anoLetivo: anoScope?.ano ?? null,
      todosAnos: allYears,
      total: count ?? 0,
      limit,
      offset,
      summary,
      items: (items ?? []).map((item: any) => ({
        ...item,
        problemas: item.problemas_abertos ?? [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
