import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";

export async function GET(req: NextRequest) {
  const s = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId");
  const anoLetivoParam = searchParams.get("anoLetivo");

  let kpiQuery = s
    .from("vw_financeiro_kpis_geral")
    .select(
      "matriculados_total, inadimplentes_total, risco_total, pagos_total, pagos_valor, pendentes_total, pendentes_valor"
    );
  if (escolaId) {
    kpiQuery = kpiQuery.eq("escola_id", escolaId);
  }

  const { data: kpiData, error: kpiError } = await kpiQuery.maybeSingle();
  if (kpiError) {
    console.error("❌ Erro ao carregar KPIs financeiros:", kpiError.message);
    return NextResponse.json(
      { error: `Erro DB (Financeiro KPIs): ${kpiError.message}` },
      { status: 500 }
    );
  }

  const totalMatriculados = Number(kpiData?.matriculados_total ?? 0);
  const totalInadimplentes = Number(kpiData?.inadimplentes_total ?? 0);
  const totalEmRisco = Number(kpiData?.risco_total ?? 0);
  const valorConfirmado = Number(kpiData?.pagos_valor ?? 0);
  const valorPendente = Number(kpiData?.pendentes_valor ?? 0);
  const confirmadosTotal = Number(kpiData?.pagos_total ?? 0);
  const pendentesTotal = Number(kpiData?.pendentes_total ?? 0);

  const percentualInadimplencia =
    totalMatriculados > 0 ? (totalInadimplentes / totalMatriculados) * 100 : 0;

  // 4) Cursos sem tabela de preços por escola/ano
  const cursosPendentes = {
    total: 0,
    totalPorEscola: {} as Record<string, number>,
    porEscolaAno: {} as Record<string, Record<string, number>>,
  };

  if (escolaId) {
    try {
      const { anoLetivo, items } = await findClassesSemPreco(s as Awaited<ReturnType<typeof supabaseServer>>, escolaId, anoLetivoParam);
      const total = items.length;

      cursosPendentes.total = total;
      cursosPendentes.totalPorEscola[escolaId] = total;
      cursosPendentes.porEscolaAno[escolaId] = {
        [String(anoLetivo)]: total,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("⚠️ Falha ao calcular preços pendentes:", message);
    }
  }

  return NextResponse.json({
    matriculados: { total: totalMatriculados ?? 0 },
    inadimplencia: { total: totalInadimplentes, percentual: percentualInadimplencia },
    risco: { total: totalEmRisco },
    confirmados: { total: confirmadosTotal, valor: valorConfirmado },
    pendentes: { total: pendentesTotal, valor: valorPendente },
    cursosPendentes,
  });
}
