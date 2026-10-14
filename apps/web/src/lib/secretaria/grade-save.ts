export type GradeNote = { aluno_id: string; valor: number | null };

export type GradeWriteContext = {
  turma_id: string;
  ano_letivo_id: string;
  disciplina_id: string;
  turma_disciplina_id: string;
  trimestre: number;
  tipo_avaliacao: string;
  is_isento: boolean;
};

export const MAX_GRADE_WRITE_BATCH = 50;

/**
 * Persist one evaluation component through the canonical secretaria endpoint.
 * The RPC limit is 50 students. Keep each idempotency key unique; do not
 * claim success until the API and the RPC both report success.
 */
export async function saveGradesInChunks(
  fetcher: (url: string, init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }) => Promise<{ ok: boolean; json: () => Promise<{
    ok?: boolean;
    error?: string;
    data?: { ok?: boolean; error?: string };
  }> }>,
  context: GradeWriteContext,
  notas: GradeNote[],
  makeKey: () => string,
): Promise<void> {
  if (!context.ano_letivo_id || !context.turma_id || !context.turma_disciplina_id || !context.disciplina_id) {
    throw new Error("Faltam informações da turma, disciplina ou ano letivo.");
  }

  for (let offset = 0; offset < notas.length; offset += MAX_GRADE_WRITE_BATCH) {
    const key = makeKey();
    if (!key.trim()) throw new Error("Idempotência de lançamento indisponível.");
    const response = await fetcher("/api/secretaria/notas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify({
        ...context,
        notas: notas.slice(offset, offset + MAX_GRADE_WRITE_BATCH),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      data?: { ok?: boolean; error?: string };
    };
    if (!response.ok || result.ok !== true || result.data?.ok === false) {
      throw new Error(result.error || result.data?.error || "Falha ao guardar notas.");
    }
  }
}
