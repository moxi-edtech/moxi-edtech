import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET(req: NextRequest) {
  const s = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId");
  const anoLetivoParam = searchParams.get("anoLetivo");

  // 1) Total de matriculados (ativos)
  let totalMatriculadosQuery = s
    .from("matriculas")
    .select("id", { count: "exact", head: true })
    .or("status.eq.ativo,status.eq.ativa");
  totalMatriculadosQuery = applyKf2ListInvariants(totalMatriculadosQuery, { defaultLimit: 1 });

  const { count: totalMatriculados, error: totalMatriculadosError } = await totalMatriculadosQuery;

  if (totalMatriculadosError) {
    console.error("❌ Erro ao contar matriculados:", totalMatriculadosError.message);
    return NextResponse.json(
      { error: `Erro DB (Matriculas): ${totalMatriculadosError.message}` },
      { status: 500 }
    );
  }

  // 2) Inadimplência e risco a partir de mensalidades (usa valor_previsto)
  const hojeStr = new Date().toISOString().slice(0, 10);
  let vencidasQuery = s
    .from("mensalidades")
    .select("aluno_id, valor_previsto, data_vencimento, status")
    .neq("status", "pago")
    .lt("data_vencimento", hojeStr)
    .order("data_vencimento", { ascending: true });
  vencidasQuery = applyKf2ListInvariants(vencidasQuery, { defaultLimit: 5000 });

  const { data: mensalidadesVencidas, error: errMensVencidas } = await vencidasQuery;

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
  let mensalidadesQuery = s
    .from("mensalidades")
    .select("status, valor_previsto")
    .order("created_at", { ascending: false });
  mensalidadesQuery = applyKf2ListInvariants(mensalidadesQuery, { defaultLimit: 5000 });

  const { data: todasMensalidades, error: errMens } = await mensalidadesQuery;
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
