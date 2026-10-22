/**
 * Scope must be resolved by the authenticated route before this policy is used.
 * Transferred-out and cancelled students are never part of an enrolment roster.
 */
export function turmaEnrollmentPolicy(historical: boolean) {
  return historical
    ? { statuses: ["ativo", "concluido"] as const, requireActive: false }
    : { statuses: ["ativo"] as const, requireActive: true };
}

/** Server-side pagination avoids the legacy 50-row turma-details truncation. */
export function turmaPageRange(page: number, size = 20) {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) {
    throw new RangeError("Invalid roster pagination.");
  }
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

/**
 * curso_matriz has two FKs pointing at disciplinas_catalogo:
 * curso_matriz_disciplina_id_fkey and curso_matriz_avaliacao_disciplina_fk.
 * PostgREST needs the explicit curriculum FK or the embed fails with PGRST201.
 */
export const TURMA_DISCIPLINAS_SELECT =
  "id,curso_matriz_id,professor_id,curso_matriz(id,disciplina_id,disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id,nome))" as const;

/** Capture the code and message of Supabase/PostgREST error objects in server logs. */
export function describeTurmaReadFailure(cause: unknown): { code: string | null; message: string } {
  if (cause instanceof Error) return { code: null, message: cause.message.slice(0, 500) };
  if (cause && typeof cause === "object") {
    const fields = cause as Record<string, unknown>;
    const code = typeof fields.code === "string" ? fields.code.slice(0, 32) : null;
    const message = typeof fields.message === "string" ? fields.message.slice(0, 500) : "unexpected";
    return { code, message };
  }
  return { code: null, message: "unexpected" };
}
