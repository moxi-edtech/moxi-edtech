import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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
  const ofertaQuery = s
    .from("cursos_oferta")
    .select("escola_id, curso_id, turmas:turma_id(ano_letivo)");

  if (escolaId) ofertaQuery.eq("escola_id", escolaId);
  if (anoLetivoParam) ofertaQuery.eq("turmas.ano_letivo", anoLetivoParam);

  const { data: ofertas, error: ofertasError } = await ofertaQuery;

  if (ofertasError) {
    console.error("❌ Erro ao buscar cursos ofertados:", ofertasError.message);
    return NextResponse.json(
      { error: `Erro DB (Cursos ofertados): ${ofertasError.message}` },
      { status: 500 }
    );
  }

  const tabelasQuery = s
    .from("financeiro_tabelas")
    .select("escola_id, ano_letivo, curso_id");

  if (escolaId) tabelasQuery.eq("escola_id", escolaId);
  if (anoLetivoParam) tabelasQuery.eq("ano_letivo", Number(anoLetivoParam));

  const { data: tabelas, error: tabelasError } = await tabelasQuery;

  if (tabelasError) {
    console.error("❌ Erro ao buscar tabelas de preço:", tabelasError.message);
    return NextResponse.json(
      { error: `Erro DB (Tabelas): ${tabelasError.message}` },
      { status: 500 }
    );
  }

  const tabelasSet = new Set(
    (tabelas || [])
      .filter((t: any) => t.curso_id)
      .map(
        (t: any) => `${t.escola_id}::${t.ano_letivo ?? ""}::${t.curso_id}`
      )
  );

  const pendentesPorEscolaAno: Record<string, Record<string, number>> = {};

  (ofertas || []).forEach((o: any) => {
    const turma = Array.isArray(o.turmas) ? o.turmas[0] : o.turmas;
    const anoLetivo = turma?.ano_letivo;
    if (!o?.curso_id || !o?.escola_id || !anoLetivo) return;

    const tabelaKey = `${o.escola_id}::${anoLetivo}::${o.curso_id}`;
    if (tabelasSet.has(tabelaKey)) return;

    const escolaKey = String(o.escola_id);
    const anoKey = String(anoLetivo);
    pendentesPorEscolaAno[escolaKey] ??= {};
    pendentesPorEscolaAno[escolaKey][anoKey] =
      (pendentesPorEscolaAno[escolaKey][anoKey] ?? 0) + 1;
  });

  const totalPorEscola: Record<string, number> = Object.fromEntries(
    Object.entries(pendentesPorEscolaAno).map(([escola, anos]) => [
      escola,
      Object.values(anos).reduce((acc, v) => acc + v, 0),
    ])
  );

  const cursosPendentesTotal = Object.values(totalPorEscola).reduce(
    (acc, v) => acc + v,
    0
  );

  return NextResponse.json({
    matriculados: { total: totalMatriculados ?? 0 },
    inadimplencia: { total: totalInadimplentes, percentual: percentualInadimplencia },
    risco: { total: totalEmRisco },
    confirmados: { total: pagos.length, valor: valorConfirmado },
    pendentes: { total: naoPagos.length, valor: valorPendente },
    cursosPendentes: {
      total: cursosPendentesTotal,
      totalPorEscola,
      porEscolaAno: pendentesPorEscolaAno,
    },
  });
}
