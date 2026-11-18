/**
 * Associa um pedido apresentado pela disciplina curricular ao identificador
 * da disciplina realmente avaliada. Função pura: não confere permissões.
 *
 * Fail-closed: um pedido nunca pode autorizar outra disciplina por
 * coincidência de alvo de avaliação na mesma turma.
 */
export type ReopeningCurriculumLink = {
  id: string;
  professor_id: string | null;
  avaliacao_disciplina_id: string | null;
  curso_matriz: {
    disciplina_id: string | null;
    avaliacao_disciplina_id: string | null;
  } | null;
};

export type ReopeningResolution =
  | { ok: true; link: ReopeningCurriculumLink; assessedSubjectId: string }
  | { ok: false; code: "UNKNOWN" | "UNRECONCILED" | "SHARED_ASSESSMENT" };

export function resolveReopeningSubject(
  links: ReadonlyArray<ReopeningCurriculumLink>,
  curriculumSubjectId: string,
): ReopeningResolution {
  const matching = links.filter((link) => link.curso_matriz?.disciplina_id === curriculumSubjectId);
  if (matching.length !== 1) return { ok: false, code: "UNKNOWN" };

  const link = matching[0];
  const assessedSubjectId = link.avaliacao_disciplina_id;
  const authoritativeAssessment =
    link.curso_matriz?.avaliacao_disciplina_id ?? link.curso_matriz?.disciplina_id;
  if (!assessedSubjectId || assessedSubjectId !== authoritativeAssessment) {
    return { ok: false, code: "UNRECONCILED" };
  }

  if (links.filter((other) => other.avaliacao_disciplina_id === assessedSubjectId).length !== 1) {
    return { ok: false, code: "SHARED_ASSESSMENT" };
  }
  return { ok: true, link, assessedSubjectId };
}
