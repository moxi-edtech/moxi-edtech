import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = (await supabaseServer()) as any;

  // 1) Dados da VIEW de inadimplência
  const {
    data: inadimplenciaDataRaw,
    error: inadimplenciaError,
  } = await supabase
    .from("vw_radar_inadimplencia")
    .select("aluno_id, valor_em_atraso");

  if (inadimplenciaError) {
    console.error(
      "❌ Erro ao buscar vw_radar_inadimplencia:",
      inadimplenciaError.message
    );
    return NextResponse.json(
      { error: `Erro DB (Radar): ${inadimplenciaError.message}` },
      { status: 500 }
    );
  }

  const inadimplenciaData = inadimplenciaDataRaw ?? [];

  // 2) Total de matriculados (escopo da escola via RLS)
  const { count: totalMatriculados, error: totalMatriculadosError } =
    await supabase
      .from("matriculas")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true);

  if (totalMatriculadosError) {
    console.error(
      "❌ Erro ao contar matriculados:",
      totalMatriculadosError.message
    );
    return NextResponse.json(
      { error: `Erro DB (Matriculas): ${totalMatriculadosError.message}` },
      { status: 500 }
    );
  }

  // 3) Pagamentos (apenas campo necessário)
  const {
    data: pagamentosDataRaw,
    error: pagamentosError,
  } = await supabase.from("pagamentos").select("conciliado, valor_pago");

  if (pagamentosError) {
    console.error("❌ Erro ao buscar pagamentos:", pagamentosError.message);
    return NextResponse.json(
      { error: `Erro DB (Pagamentos): ${pagamentosError.message}` },
      { status: 500 }
    );
  }

  const pagamentosData = pagamentosDataRaw ?? [];

  // 4) Cálculos

  // alunos com alguma linha na view → em inadimplência (RLS escopa por escola)
  const totalInadimplentes = new Set(
    inadimplenciaData.map((item) => item.aluno_id)
  ).size;

  const percentualInadimplencia =
    totalMatriculados && totalMatriculados > 0
      ? (totalInadimplentes / totalMatriculados) * 100
      : 0;

  const totalEmRisco = inadimplenciaData.reduce((acc, item) => {
    const valor = Number(item.valor_em_atraso ?? 0);
    return acc + (isNaN(valor) ? 0 : valor);
  }, 0);

  const totalConfirmados = pagamentosData.filter((p) => p.conciliado).length;
  const totalPendentes = pagamentosData.filter((p) => !p.conciliado).length;
  const valorConfirmado = pagamentosData
    .filter((p) => p.conciliado)
    .reduce((acc, p) => acc + Number(p.valor_pago ?? 0), 0);
  const valorPendente = pagamentosData
    .filter((p) => !p.conciliado)
    .reduce((acc, p) => acc + Number(p.valor_pago ?? 0), 0);

  return NextResponse.json({
    matriculados: {
      total: totalMatriculados ?? 0,
    },
    inadimplencia: {
      total: totalInadimplentes,
      percentual: percentualInadimplencia,
    },
    risco: {
      total: totalEmRisco,
    },
    confirmados: {
      total: totalConfirmados,
      valor: valorConfirmado,
    },
    pendentes: {
      total: totalPendentes,
      valor: valorPendente,
    },
  });
}
