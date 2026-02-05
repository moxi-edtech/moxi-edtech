import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const metaEscolaId = (userRes?.user?.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const anoParam = searchParams.get("ano");
    const anoLetivo = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear();

    // 1) Série mensal (para gráficos)
    let mensalQuery = supabase
      .from("vw_financeiro_propinas_mensal_escola")
      .select(
        `
        escola_id,
        ano_letivo,
        ano,
        mes,
        competencia_mes,
        qtd_mensalidades,
        qtd_em_atraso,
        total_previsto,
        total_pago,
        total_em_atraso,
        inadimplencia_pct
      `
      )
      .eq("ano_letivo", anoLetivo)
      .eq("escola_id", escolaId);

    mensalQuery = applyKf2ListInvariants(mensalQuery, {
      defaultLimit: 50,
      order: [
        { column: "ano", ascending: true },
        { column: "mes", ascending: true },
      ],
    });

    const { data: mensal, error: mensalError } = await mensalQuery;

    if (mensalError) {
      console.error("[financeiro/relatorios/propinas] mensalError", mensalError);
      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao carregar resumo mensal de propinas.",
          details: mensalError.message,
        },
        { status: 500 }
      );
    }

    // 2) Ranking por turma (MV)
    let turmaQuery = supabase
      .from("vw_financeiro_propinas_por_turma")
      .select(
        `
        escola_id,
        ano_letivo,
        turma_id,
        turma_nome,
        classe_label,
        turno,
        qtd_mensalidades,
        qtd_em_atraso,
        total_previsto,
        total_pago,
        total_em_atraso,
        inadimplencia_pct
      `
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo);

    turmaQuery = applyKf2ListInvariants(turmaQuery, {
      defaultLimit: 50,
      order: [
        { column: "inadimplencia_pct", ascending: false },
        { column: "total_em_atraso", ascending: false },
        { column: "turma_id", ascending: true },
      ],
    });

    const { data: porTurma, error: turmaError } = await turmaQuery;

    if (turmaError) {
      console.error("[financeiro/relatorios/propinas] turmaError", turmaError);
      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao carregar resumo de propinas por turma.",
          details: turmaError.message,
        },
        { status: 500 }
      );
    }

    // Normalização para o front
    const mensalSeries = (mensal ?? []).map((row) => ({
      anoLetivo: row.ano_letivo,
      ano: row.ano,
      mes: row.mes,
      labelMes: `${String(row.mes).padStart(2, "0")}/${row.ano}`,
      competenciaMes: row.competencia_mes,
      qtdMensalidades: Number(row.qtd_mensalidades ?? 0),
      qtdEmAtraso: Number(row.qtd_em_atraso ?? 0),
      totalPrevisto: Number(row.total_previsto ?? 0),
      totalPago: Number(row.total_pago ?? 0),
      totalEmAtraso: Number(row.total_em_atraso ?? 0),
      inadimplenciaPct: Number(row.inadimplencia_pct ?? 0),
    }));

    const rankingTurmas = (porTurma ?? []).map((row) => ({
      turmaId: row.turma_id,
      turmaNome: row.turma_nome,
      classe: row.classe_label,
      turno: row.turno,
      anoLetivo: row.ano_letivo,
      qtdMensalidades: Number(row.qtd_mensalidades ?? 0),
      qtdEmAtraso: Number(row.qtd_em_atraso ?? 0),
      totalPrevisto: Number(row.total_previsto ?? 0),
      totalPago: Number(row.total_pago ?? 0),
      totalEmAtraso: Number(row.total_em_atraso ?? 0),
      inadimplenciaPct: Number(row.inadimplencia_pct ?? 0),
    }));

    return NextResponse.json(
      {
        ok: true,
        anoLetivo,
        mensal: mensalSeries,
        porTurma: rankingTurmas,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[financeiro/relatorios/propinas] fatal", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao carregar relatório de propinas.",
      },
      { status: 500 }
    );
  }
}
