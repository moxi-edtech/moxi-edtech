import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId || !ctx.matriculaId || !ctx.turmaId) {
      return NextResponse.json({ ok: true, result: null });
    }

    const { data: disciplinas, error } = await supabase
      .from("turma_disciplinas")
      .select("avaliacao_disciplina_id")
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", ctx.turmaId)
      .not("avaliacao_disciplina_id", "is", null);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const results = await Promise.all((disciplinas ?? []).map(async (row) => {
      const { data, error: resolverError } = await (supabase as any).rpc("resolve_estado_resultado", {
        p_matricula_id: ctx.matriculaId as string,
        p_disciplina_id: row.avaliacao_disciplina_id as string,
      });
      if (resolverError) throw resolverError;
      const resolved = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
      return { disciplina_id: row.avaliacao_disciplina_id, status: typeof resolved.status === "string" ? resolved.status : null, motivo: typeof resolved.motivo === "string" ? resolved.motivo : null, nota: typeof resolved.nota === "number" ? resolved.nota : null };
    }));

    const indisciplina = results.filter((item) => item.status === "reprovado_por_indisciplina");
    const negativos = results.filter((item) => item.status === "reprovado");
    const pendentes = results.filter((item) => ["pendente_dados", "pendente_formula"].includes(String(item.status)));
    const result = indisciplina.length > 0
      ? { status: "retido", motivo: "indisciplina_grave", mensagem: "Retido por indisciplina grave.", disciplinas_afetadas: indisciplina.length }
      : negativos.length > 0
        ? { status: "reprovado", motivo: "aproveitamento", mensagem: "Existem disciplinas com resultado negativo.", disciplinas_afetadas: negativos.length }
        : pendentes.length > 0
          ? { status: "pendente", motivo: "dados_ou_formula", mensagem: "O resultado final aguarda dados ou fórmula.", disciplinas_afetadas: pendentes.length }
          : { status: "aprovado", motivo: "sem_pendencias", mensagem: "Sem pendências de resultado no resolvedor.", disciplinas_afetadas: 0 };

    return NextResponse.json({ ok: true, matricula_id: ctx.matriculaId, ano_letivo: ctx.anoLetivo, result, disciplinas: results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar o estado RAA." }, { status: 500 });
  }
}
