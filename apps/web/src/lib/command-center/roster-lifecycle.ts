import {
  isSituacaoMatriculaContextual, isSituacaoResultadoContextual,
  type SituacaoMatriculaContextual, type SituacaoResultadoContextual,
} from "@/lib/matriculas/lifecycle-status-contract";

export type RosterLifecycle = {
  situacaoMatricula: SituacaoMatriculaContextual;
  situacaoResultado: SituacaoResultadoContextual;
  resultadoOficial: string | null;
};

/** One tenant-scoped batch per roster page, never an N+1 query. Read-only. */
export async function carregarSituacoesRoster(
  // Connector clients have distinct generated schemas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, escolaId: string, ano: number, studentIds: readonly string[],
): Promise<Map<string, RosterLifecycle>> {
  const ids = [...new Set(studentIds.filter(Boolean))];
  const result = new Map<string, RosterLifecycle>();
  if (!ids.length) return result;
  if (ids.length > 200) throw new Error("Lote de situação de matrícula demasiado grande.");
  const { data, error } = await db.from("v_student_lifecycle_status_v2")
    .select("aluno_id, escola_id, ano_letivo, situacao_contextual, situacao_resultado, resultado_oficial")
    .eq("escola_id", escolaId).eq("ano_letivo", ano).in("aluno_id", ids).limit(ids.length * 3 + 1);
  if (error || !data || data.length > ids.length * 3) {
    throw new Error("Falha ao consultar a situação académica da lista.");
  }
  for (const item of data) {
    if (item.escola_id !== escolaId || Number(item.ano_letivo) !== ano || !ids.includes(item.aluno_id)
      || !isSituacaoMatriculaContextual(item.situacao_contextual)
      || !isSituacaoResultadoContextual(item.situacao_resultado)) {
      throw new Error("Resposta de matrícula com âmbito ou contrato inválido.");
    }
    if (result.has(item.aluno_id)) {
      // Multiple enrollments in one school/year need review, never silently choose one.
      result.set(item.aluno_id, {
        situacaoMatricula: "revisao_integridade",
        situacaoResultado: "sem_resultado_oficial", resultadoOficial: null,
      });
    } else {
      result.set(item.aluno_id, {
        situacaoMatricula: item.situacao_contextual,
        situacaoResultado: item.situacao_resultado,
        resultadoOficial: item.resultado_oficial ?? null,
      });
    }
  }
  // A student in a roster but missing from the canonical view is a data
  // divergence; don't misrepresent it as a confirmed enrollment.
  for (const id of ids) if (!result.has(id)) {
    result.set(id, {
      situacaoMatricula: "revisao_integridade",
      situacaoResultado: "sem_resultado_oficial", resultadoOficial: null,
    });
  }
  return result;
}
