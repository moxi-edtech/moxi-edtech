import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";

export async function GET(req: NextRequest) {
  const s = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId");
  const anoLetivoParam = searchParams.get("anoLetivo");

  // 1) Total de matriculados (ativos)
  const { count: totalMatriculados, error: totalMatriculadosError } = await s
    .from("matriculas")
    .select("*", { count: "exact", head: true })
    .or("status.eq.ativo,status.eq.ativa");

  if (totalMatriculadosError) {
    console.error("❌ Erro ao contar matriculados:", totalMatriculadosError.message);
    return NextResponse.json(
      { error: `Erro DB (Matriculas): ${totalMatriculadosError.message}` },
      { status: 500 }
    );
  }

  // 2) Inadimplência e risco a partir de mensalidades (usa valor_previsto)
  const hojeStr = new Date().toISOString().slice(0, 10);
  const { data: mensalidadesVencidas, error: errMensVencidas } = await s
    .from("mensalidades")
    .select("aluno_id, valor_previsto, data_vencimento, status")
    .neq("status", "pago")
    .lt("data_vencimento", hojeStr);

  if (errMensVencidas) {
    console.error("❌ Erro ao buscar inadimplência:", errMensVencidas.message);
    return NextResponse.json(
      { error: `Erro DB (Inadimplência): ${errMensVencidas.message}` },
      { status: 500 }
    );
  }

  const inadimplenciaData = mensalidadesVencidas ?? [];
  const totalInadimplentes = new Set(inadimplenciaData.map((i: any) => i.aluno_id)).size;
  const totalEmRisco = inadimplenciaData.reduce(
    (acc: number, i: any) => acc + Number(i.valor_previsto ?? 0),
    0
  );

  // 3) Confirmados x pendentes (mensalidades)
  const { data: todasMensalidades, error: errMens } = await s
    .from("mensalidades")
    .select("status, valor_previsto");
  if (errMens) {
    console.error("❌ Erro ao buscar mensalidades:", errMens.message);
    return NextResponse.json(
      { error: `Erro DB (Mensalidades): ${errMens.message}` },
      { status: 500 }
    );
  }

  const pagos = (todasMensalidades ?? []).filter((m: any) => m.status === "pago");
  const naoPagos = (todasMensalidades ?? []).filter((m: any) => m.status !== "pago");

  const valorConfirmado = pagos.reduce((acc: number, m: any) => acc + Number(m.valor_previsto ?? 0), 0);
  const valorPendente = naoPagos.reduce((acc: number, m: any) => acc + Number(m.valor_previsto ?? 0), 0);

  const percentualInadimplencia =
    totalMatriculados && totalMatriculados > 0
      ? (totalInadimplentes / totalMatriculados) * 100
      : 0;

  // 4) Cursos sem tabela de preços por escola/ano
  const cursosPendentes = {
    total: 0,
    totalPorEscola: {} as Record<string, number>,
    porEscolaAno: {} as Record<string, Record<string, number>>,
  };

  if (escolaId) {
    try {
      const { anoLetivo, items } = await findClassesSemPreco(s as any, escolaId, anoLetivoParam);
      const total = items.length;

      cursosPendentes.total = total;
      cursosPendentes.totalPorEscola[escolaId] = total;
      cursosPendentes.porEscolaAno[escolaId] = {
        [String(anoLetivo)]: total,
      };
    } catch (e: any) {
      console.warn("⚠️ Falha ao calcular preços pendentes:", e?.message || e);
    }
  }

  return NextResponse.json({
    matriculados: { total: totalMatriculados ?? 0 },
    inadimplencia: { total: totalInadimplentes, percentual: percentualInadimplencia },
    risco: { total: totalEmRisco },
    confirmados: { total: pagos.length, valor: valorConfirmado },
    pendentes: { total: naoPagos.length, valor: valorPendente },
    cursosPendentes,
  });
}
