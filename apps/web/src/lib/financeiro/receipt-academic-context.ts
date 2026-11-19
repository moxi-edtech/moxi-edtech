/**
 * Read-only academic context for an issued monthly receipt.
 *
 * Never infer the class from the student's most recently updated enrollment:
 * a reconciliation of an older school year can update that row later.
 * Only the enrollment referenced by the charged mensalidade is authoritative.
 */
export type ReceiptAcademicContext = {
  turmaNome: string | null;
  turmaTurno: string | null;
  classeNome: string | null;
  cursoNome: string | null;
  anoLetivo: number | null;
};

export async function resolveReceiptAcademicContext(
  db: any,
  params: { escolaId: string; alunoId: string | null; mensalidadeId: string | null },
): Promise<ReceiptAcademicContext | null> {
  const { escolaId, alunoId, mensalidadeId } = params;
  if (!escolaId || !alunoId || !mensalidadeId) return null;

  const { data: mensalidade, error: mensalidadeError } = await db
    .from("mensalidades")
    .select("id, matricula_id, turma_id, ano_letivo")
    .eq("id", mensalidadeId)
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .maybeSingle();
  if (mensalidadeError || !mensalidade?.matricula_id) return null;

  const { data: matricula, error: matriculaError } = await db
    .from("matriculas")
    .select("id, turma_id, ano_letivo")
    .eq("id", mensalidade.matricula_id)
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .maybeSingle();
  if (matriculaError || !matricula?.turma_id) return null;

  // Never silently display a class from another charge, school year or
  // a different turma after an ambiguous transfer/rectification.
  if (
    (mensalidade.ano_letivo != null &&
      String(mensalidade.ano_letivo) !== String(matricula.ano_letivo)) ||
    (mensalidade.turma_id && mensalidade.turma_id !== matricula.turma_id)
  ) return null;

  const { data: turma, error: turmaError } = await db
    .from("turmas")
    .select("id, nome, turno, ano_letivo, classes ( nome ), cursos ( nome )")
    .eq("id", matricula.turma_id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (
    turmaError || !turma ||
    (turma.ano_letivo != null && String(turma.ano_letivo) !== String(matricula.ano_letivo))
  ) return null;

  const classe = Array.isArray(turma.classes) ? turma.classes[0] : turma.classes;
  const curso = Array.isArray(turma.cursos) ? turma.cursos[0] : turma.cursos;
  return {
    turmaNome: turma.nome ?? null,
    turmaTurno: turma.turno ?? null,
    classeNome: classe?.nome ?? null,
    cursoNome: curso?.nome ?? null,
    anoLetivo: matricula.ano_letivo != null && Number.isFinite(Number(matricula.ano_letivo))
      ? Number(matricula.ano_letivo)
      : null,
  };
}
