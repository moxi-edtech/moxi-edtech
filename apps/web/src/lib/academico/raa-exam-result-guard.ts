export type ExamGuardInput = {
  source: { aluno_id: string; turma_id: string; session_id: string; status: string } | null;
  session: { id: string; turma_id: string | null; ano_letivo_id: string; estado: string } | null;
  turmaDisciplina: { turma_id: string } | null;
  componente: { exame_sessao_id: string; nota_max: number } | null;
  alunoId: string;
  nota: number | null;
};
/** Returns a code, never a permission. Authz and multi-tenant checks stay on the server. */
export function validateRaaExamResult(input: ExamGuardInput): string | null {
  const { source, session, turmaDisciplina, componente, alunoId, nota } = input;
  if (!source || !session) return "EXAM_ENROLMENT_OR_SESSION_NOT_FOUND";
  if (source.aluno_id !== alunoId ||
      (session.turma_id !== null && source.turma_id !== session.turma_id)) return "EXAM_SOURCE_MISMATCH";
  if (source.status !== "ativo") return "RAA_LEGAL_LOCK";
  if (source.session_id !== session.ano_letivo_id) return "EXAM_YEAR_MISMATCH";
  if (!["aberta", "publicada"].includes(session.estado)) return "EXAM_SESSION_LOCKED";
  if (!turmaDisciplina || turmaDisciplina.turma_id !== source.turma_id) return "EXAM_DISCIPLINE_MISMATCH";
  if (!componente || componente.exame_sessao_id !== session.id) return "EXAM_COMPONENT_MISMATCH";
  if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > Number(componente.nota_max))) {
    return "EXAM_NOTE_EXCEEDS_MAX";
  }
  return null;
}
