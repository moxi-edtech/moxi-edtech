import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

function isMissingReadModelError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(message)
  );
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
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

    const anoLetivoId = searchParams.get("ano_letivo_id") || searchParams.get("session_id") || null;
    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId,
      ano: searchParams.get("ano") ? parseInt(searchParams.get("ano")!, 10) : null,
    });
    const anoLetivo = anoScope?.ano ?? new Date().getFullYear();
    const sessionId = anoScope?.id;

    // Orquestração de Queries Paralelas
    const [
      resumoRes,
      propinasMensalRes,
      propinasTurmaRes,
      captacaoRes,
      despesasRes,
      fluxoMensalRes,
      inadimplenciaClasseRes
    ] = await Promise.all([
      // 1. Resumo
      supabase.from("vw_financeiro_kpis_geral").select("*").eq("escola_id", escolaId).eq("ano_letivo", anoLetivo).maybeSingle(),
      
      // 2. Propinas Mensal
      applyKf2ListInvariants(
        supabase.from("vw_financeiro_propinas_mensal_escola").select("*").eq("escola_id", escolaId).eq("ano_letivo", anoLetivo),
        { defaultLimit: 50, order: [{ column: "ano", ascending: true }, { column: "mes", ascending: true }], tieBreakerColumn: "competencia_mes" }
      ),

      // 3. Propinas por Turma
      applyKf2ListInvariants(
        supabase.from("vw_financeiro_propinas_por_turma").select("*").eq("escola_id", escolaId).eq("ano_letivo", anoLetivo),
        { defaultLimit: 50, order: [{ column: "inadimplencia_pct", ascending: false }, { column: "total_em_atraso", ascending: false }], tieBreakerColumn: "turma_id" }
      ),

      // 4. Captação (Nova View)
      sessionId 
        ? supabase.from("vw_relatorio_financeiro_escolar_capitacao_mensal").select("*").eq("escola_id", escolaId).eq("ano_letivo", anoLetivo)
        : Promise.resolve({ data: [], error: null }),

      // 5. Despesas
      supabase.from("financeiro_lancamentos").select("categoria, valor_total, status").eq("escola_id", escolaId).eq("tipo", "saida").eq("ano_referencia", anoLetivo),

      // 6. Fluxo Mensal
      sessionId 
        ? supabase.from("vw_relatorio_financeiro_escolar_fluxo_mensal").select("*").eq("escola_id", escolaId).eq("ano_letivo_id", sessionId)
        : Promise.resolve({ data: [], error: null }),

      // 7. Inadimplência por Classe
      sessionId 
        ? supabase.from("vw_relatorio_financeiro_escolar_inadimplencia_classe").select("*").eq("escola_id", escolaId).eq("ano_letivo_id", sessionId)
        : Promise.resolve({ data: [], error: null })
    ]);

    // Processamento do Resumo
    const kpi = resumoRes.data;
    const resumo = kpi ? {
      mensalidades: Number(kpi.qtd_mensalidades || 0),
      emAtraso: Number(kpi.qtd_em_atraso || 0),
      pagasAdiantadas: Number(kpi.qtd_pagas_adiantadas || 0),
      parciais: Number(kpi.qtd_parciais || 0),
      previsto: Number(kpi.total_previsto || 0),
      pago: Number(kpi.total_pago || 0),
      pagoAdiantado: Number(kpi.total_pago_adiantado || 0),
      parcialEmAberto: Number(kpi.total_parcial_em_aberto || 0),
      atraso: Number(kpi.total_em_atraso || 0),
      despesasTotal: Number(kpi.total_saidas || 0),
      entradasTotal: Number(kpi.total_entradas || 0),
      saldoAnterior: Number(kpi.saldo_anterior || 0),
      saldoPeriodo: Number(kpi.saldo_periodo || 0),
      saldoAcumulado: Number(kpi.saldo_acumulado || 0),
      taxaAtrasoPct: Number(kpi.taxa_atraso_pct || 0),
    } : null;

    // Processamento Propinas
    const mensal = (propinasMensalRes.data || []).map(row => {
      const date = new Date(row.ano, row.mes - 1, 1);
      const labelMes = date.toLocaleDateString("pt-PT", { month: "short", year: "numeric" })
        .replace(".", "")
        .replace(" de ", "/");
      
      return {
        anoLetivo: row.ano_letivo,
        ano: row.ano,
        mes: row.mes,
        labelMes: labelMes.charAt(0).toUpperCase() + labelMes.slice(1),
        competenciaMes: row.competencia_mes,
        qtdMensalidades: Number(row.qtd_mensalidades || 0),
        qtdEmAtraso: Number(row.qtd_em_atraso || 0),
        qtdPagasAdiantadas: Number(row.qtd_pagas_adiantadas || 0),
        qtdParciais: Number(row.qtd_parciais || 0),
        totalPrevisto: Number(row.total_previsto || 0),
        totalPago: Number(row.total_pago || 0),
        totalPagoAdiantado: Number(row.total_pago_adiantado || 0),
        totalParcialEmAberto: Number(row.total_parcial_em_aberto || 0),
        totalEmAtraso: Number(row.total_em_atraso || 0),
        inadimplenciaPct: Number(row.inadimplencia_pct || 0),
      };
    });

    const porTurma = (propinasTurmaRes.data || []).map(row => ({
      turmaId: row.turma_id,
      turmaNome: row.turma_nome,
      classe: row.classe_label,
      turno: row.turno,
      anoLetivo: row.ano_letivo,
      qtdMensalidades: Number(row.qtd_mensalidades || 0),
      qtdEmAtraso: Number(row.qtd_em_atraso || 0),
      totalPrevisto: Number(row.total_previsto || 0),
      totalPago: Number(row.total_pago || 0),
      totalPagoAdiantado: Number(row.total_pago_adiantado || 0),
      totalParcialEmAberto: Number(row.total_parcial_em_aberto || 0),
      totalEmAtraso: Number(row.total_em_atraso || 0),
      inadimplenciaPct: Number(row.inadimplencia_pct || 0),
      qtdPagasAdiantadas: Number(row.qtd_pagas_adiantadas || 0),
      qtdParciais: Number(row.qtd_parciais || 0),
    }));

    // Processamento Captação
    const captacaoMap: Record<string, any> = {};
    (captacaoRes.data || []).forEach(row => {
      const classeId = row.classe_id;
      if (!captacaoMap[classeId]) {
        captacaoMap[classeId] = {
          classeId,
          label: row.classe_label,
          matriculas: 0,
          confirmacoes: 0,
          bolsistas: 0,
          total: 0,
          detalhes_mensais: {},
        };
      }
      captacaoMap[classeId].matriculas += row.matriculas_qtd;
      captacaoMap[classeId].confirmacoes += row.confirmacoes_qtd;
      captacaoMap[classeId].bolsistas += row.bolsistas_qtd;
      captacaoMap[classeId].total += row.total_qtd;
      captacaoMap[classeId].detalhes_mensais[row.mes_ref.slice(0, 7)] = {
        matriculas: row.matriculas_qtd,
        confirmacoes: row.confirmacoes_qtd,
        bolsistas: row.bolsistas_qtd
      };
    });

    // Processamento Despesas
    const despesasMap: Record<string, { label: string, total: number, qtd: number }> = {};
    let totalDespesas = 0;
    (despesasRes.data || []).forEach(d => {
      const cat = d.categoria || 'outros';
      if (!despesasMap[cat]) despesasMap[cat] = { label: cat.charAt(0).toUpperCase() + cat.slice(1), total: 0, qtd: 0 };
      const val = Number(d.valor_total || 0);
      despesasMap[cat].total += val;
      despesasMap[cat].qtd += 1;
      totalDespesas += val;
    });

    return NextResponse.json({
      ok: true,
      anoLetivo,
      resumo,
      mensal,
      porTurma,
      captacao: Object.values(captacaoMap),
      despesas: Object.values(despesasMap),
      totalDespesas,
      fluxoMensal: (fluxoMensalRes.data || []).map(f => ({
        mesRef: f.mes_ref,
        saldoAnterior: Number(f.saldo_anterior || 0),
        entradasTotal: Number(f.entradas_total || 0),
        saidasTotal: Number(f.saidas_total || 0),
        diferenca: Number(f.diferenca || 0),
        saldoFinal: Number(f.saldo_final || 0),
      })),
      inadimplenciaClasse: (inadimplenciaClasseRes.data || []).map(i => ({
        mesRef: i.mes_ref,
        classeId: i.classe_id,
        classeLabel: i.classe_label,
        qtdEmAtraso: Number(i.qtd_em_atraso || 0),
        valorUnitarioMedio: Number(i.valor_unitario_medio || 0),
        totalEmAtraso: Number(i.total_em_atraso || 0),
        qtdParciais: Number(i.qtd_parciais || 0),
        totalParcialEmAberto: Number(i.total_parcial_em_aberto || 0),
      }))
    });

  } catch (err: any) {
    console.error("[financeiro/relatorios/escolar/full] fatal", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar relatório consolidado" }, { status: 500 });
  }
}
