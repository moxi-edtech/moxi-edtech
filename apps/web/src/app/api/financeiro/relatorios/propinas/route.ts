import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";

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
      .order("ano", { ascending: true })
      .order("mes", { ascending: true });

    mensalQuery = applyKf2ListInvariants(mensalQuery, { defaultLimit: 500 });

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

    // 2) Ranking por turma (para tabela)
    let turmaQuery = supabase
      .rpc("get_propinas_por_turma", { p_ano_letivo: anoLetivo })
      .order("inadimplencia_pct", { ascending: false })
      .order("total_em_atraso", { ascending: false });

    turmaQuery = applyKf2ListInvariants(turmaQuery, { defaultLimit: 500 });

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
