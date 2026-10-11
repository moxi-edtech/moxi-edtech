import { describeAcademicCarryover, type AcademicCarryoverStatus } from "@/lib/academico/dependencias-transicao";

type CarryoverQuery = {
  escolaId: string;
  alunoId?: string | null;
  statuses?: AcademicCarryoverStatus[];
  limit?: number;
};

export async function fetchAcademicCarryovers(
  supabase: any,
  query: CarryoverQuery,
) {
  let builder = supabase
    .from("dependencias_academicas_transicao")
    .select(
      "id, escola_id, aluno_id, matricula_origem_id, matricula_destino_id, disciplina_id, status, raa_decision_origem, raa_motivo_origem, resultado_status, resultado_nota, resultado_motivo, fonte_resolucao, exame_sessao_id, resolvido_em, ultima_sincronizacao_em, created_at, updated_at",
    )
    .eq("escola_id", query.escolaId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(query.limit ?? 100, 1), 200));

  if (query.alunoId) builder = builder.eq("aluno_id", query.alunoId);
  if (query.statuses?.length) builder = builder.in("status", query.statuses);

  const { data: rows, error } = await builder;
  if (error) throw error;

  const items = rows ?? [];
  if (items.length === 0) return [];

  const disciplinaIds = [...new Set(items.map((row: any) => row.disciplina_id).filter(Boolean))];
  const matriculaIds = [...new Set(
    items.flatMap((row: any) => [row.matricula_origem_id, row.matricula_destino_id]).filter(Boolean),
  )];

  const [{ data: disciplinas }, { data: matriculas }] = await Promise.all([
    disciplinaIds.length
      ? supabase
          .from("disciplinas_catalogo")
          .select("id, nome, sigla")
          .eq("escola_id", query.escolaId)
          .in("id", disciplinaIds)
      : Promise.resolve({ data: [] }),
    matriculaIds.length
      ? supabase
          .from("matriculas")
          .select("id, ano_letivo, turma_id")
          .eq("escola_id", query.escolaId)
          .in("id", matriculaIds)
      : Promise.resolve({ data: [] }),
  ]);

  const disciplinaById = new Map((disciplinas ?? []).map((row: any) => [row.id, row]));
  const matriculaById = new Map((matriculas ?? []).map((row: any) => [row.id, row]));

  return items.map((row: any) => {
    const disciplina = disciplinaById.get(row.disciplina_id) as any;
    const origem = matriculaById.get(row.matricula_origem_id) as any;
    const destino = row.matricula_destino_id
      ? matriculaById.get(row.matricula_destino_id) as any
      : null;
    const status = row.status as AcademicCarryoverStatus;

    return {
      id: row.id,
      aluno_id: row.aluno_id,
      status,
      presentation: describeAcademicCarryover(status, row.fonte_resolucao),
      disciplina: {
        id: row.disciplina_id,
        nome: disciplina?.nome ?? "Disciplina",
        sigla: disciplina?.sigla ?? null,
      },
      origem: {
        matricula_id: row.matricula_origem_id,
        ano_letivo: origem?.ano_letivo ?? null,
      },
      destino: row.matricula_destino_id
        ? {
            matricula_id: row.matricula_destino_id,
            ano_letivo: destino?.ano_letivo ?? null,
          }
        : null,
      raa: {
        decision: row.raa_decision_origem,
        motivo: row.raa_motivo_origem,
      },
      resultado: {
        status: row.resultado_status,
        nota: row.resultado_nota == null ? null : Number(row.resultado_nota),
        motivo: row.resultado_motivo,
        fonte: row.fonte_resolucao,
        exame_sessao_id: row.exame_sessao_id,
        resolvido_em: row.resolvido_em,
      },
      ultima_sincronizacao_em: row.ultima_sincronizacao_em,
      updated_at: row.updated_at,
    };
  });
}
