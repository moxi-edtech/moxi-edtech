export type TeacherAcademicClass = {
  id: string;
  nome: string | null;
  curso_id: string | null;
  classe_id: string | null;
  status_fecho: string | null;
};
export type CanonicalClassSubject = {
  id: string;
  turma_id: string;
  curso_matriz_id: string;
  professor_id: string | null;
};
export type PublishedSubjectMatrix = {
  id: string;
  curso_id: string | null;
  classe_id: string | null;
  disciplina_id: string | null;
  curso_curriculo_id: string | null;
};
export type SubjectName = { id: string; nome: string | null };
export type AlternateTeacherAssignment = { turma_id: string; disciplina_id: string };

export type TeacherAcademicAssignment = {
  id: string;
  turma_disciplina_id: string;
  curso_matriz_id: string;
  turma: { id: string; nome: string | null; status_fecho: string | null };
  disciplina: { id: string; nome: string | null };
};

/**
 * Fonte única: turma_disciplinas + curso_matriz publicada. Uma atribuição
 * docente não equivale a uma aula agendada. Nunca preencher aulas por inferência.
 */
export function selectTeacherCanonicalAssignments(scope: {
  professorId: string;
  classes: ReadonlyArray<TeacherAcademicClass>;
  links: ReadonlyArray<CanonicalClassSubject>;
  matrices: ReadonlyArray<PublishedSubjectMatrix>;
  subjects: ReadonlyArray<SubjectName>;
  alternate: ReadonlyArray<AlternateTeacherAssignment>;
  publishedCurriculumIds: ReadonlySet<string>;
}): TeacherAcademicAssignment[] {
  const classes = new Map(scope.classes.map((turma) => [turma.id, turma]));
  const matrices = new Map(scope.matrices.map((matrix) => [matrix.id, matrix]));
  const names = new Map(scope.subjects.map((subject) => [subject.id, subject.nome]));
  const alternate = new Set(scope.alternate.map((row) => `${row.turma_id}:${row.disciplina_id}`));
  const unique = new Map<string, TeacherAcademicAssignment>();
  const ambiguous = new Set<string>();

  for (const link of scope.links) {
    const turma = classes.get(link.turma_id);
    const matrix = matrices.get(link.curso_matriz_id);
    if (!turma || !matrix || !matrix.disciplina_id || !matrix.curso_curriculo_id) continue;
    if (turma.curso_id !== matrix.curso_id || turma.classe_id !== matrix.classe_id) continue;
    if (!scope.publishedCurriculumIds.has(matrix.curso_curriculo_id)) continue;
    if (link.professor_id !== scope.professorId &&
        !alternate.has(`${turma.id}:${matrix.disciplina_id}`)) continue;

    const key = `${turma.id}:${matrix.disciplina_id}`;
    if (ambiguous.has(key)) continue;
    const current = unique.get(key);
    // Se a mesma disciplina aponta para matrizes diferentes no mesmo ano,
    // não seleccionar arbitrariamente qual pauta publicar.
    if (current && current.curso_matriz_id !== matrix.id) {
      ambiguous.add(key);
      unique.delete(key);
      continue;
    }
    unique.set(key, {
      id: link.id,
      turma_disciplina_id: link.id,
      curso_matriz_id: matrix.id,
      turma: { id: turma.id, nome: turma.nome, status_fecho: turma.status_fecho },
      disciplina: { id: matrix.disciplina_id, nome: names.get(matrix.disciplina_id) ?? null },
    });
  }
  return [...unique.values()].sort((a, b) =>
    (a.turma.nome ?? "").localeCompare(b.turma.nome ?? "", "pt-AO") ||
    (a.disciplina.nome ?? "").localeCompare(b.disciplina.nome ?? "", "pt-AO"));
}
