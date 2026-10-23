import { isEntityInAcademicYear } from "./academic-relations";

/** Rows have already been school-scoped by the authenticated API. */
export type DisciplinaTurmaRow = {
  id: string;
  nome: string;
  turno: string | null;
  classeNome: string | null;
  cursoNome: string | null;
  anoLetivo: number | null;
  anoLetivoId: string | null;
};

export type DisciplinaTeacher = { id: string; nome: string };
export type DisciplinaAssignment = { turmaId: string; professorId: string | null };
export type DisciplinaCurriculumRow = {
  id?: string;
  cursoId: string | null;
  cursoNome: string | null;
  classeId: string | null;
  classeNome: string | null;
  cargaHorariaSemanal: number | null;
  obrigatoria: boolean | null;
  /** Current database activity: NOT a snapshot of the historical year. */
  ativo?: boolean | null;
  /** A separate older/current row may exist for the same Curso/Classe. */
  hasOtherActivityVersion?: boolean;
};

/** Never extrapolate across years from a legacy numeric year when an ID is present. */
export function isDisciplinaTurmaInYear(
  turma: Pick<DisciplinaTurmaRow, "anoLetivo" | "anoLetivoId">,
  academicYear: { id: string; ano: number },
) {
  return isEntityInAcademicYear(turma, academicYear);
}

export function composeDisciplinaOverview(input: {
  turmas: DisciplinaTurmaRow[];
  assignments: DisciplinaAssignment[];
  teachers: DisciplinaTeacher[];
  curriculum: DisciplinaCurriculumRow[];
  academicYear: { id: string; ano: number };
}) {
  const availableTurmas = new Map(
    input.turmas.filter((turma) => isDisciplinaTurmaInYear(turma, input.academicYear))
      .map((turma) => [turma.id, turma] as const),
  );
  const teacherMap = new Map(input.teachers.map((teacher) => [teacher.id, teacher] as const));
  const unresolvedTeacherIds = new Set<string>();
  const assignmentsByTurma = new Map<string, Set<string>>();

  for (const row of input.assignments) {
    if (!availableTurmas.has(row.turmaId)) continue;
    if (!assignmentsByTurma.has(row.turmaId)) assignmentsByTurma.set(row.turmaId, new Set());
    if (row.professorId) {
      assignmentsByTurma.get(row.turmaId)!.add(row.professorId);
      if (!teacherMap.has(row.professorId)) unresolvedTeacherIds.add(row.professorId);
    }
  }

  const turmas = [...assignmentsByTurma.entries()].map(([turmaId, ids]) => {
    const turma = availableTurmas.get(turmaId)!;
    return {
      id: turma.id,
      nome: turma.nome,
      turno: turma.turno,
      classeNome: turma.classeNome,
      cursoNome: turma.cursoNome,
      professores: [...ids].map((id) => teacherMap.get(id) ?? { id, nome: "Professor com vínculo registado · identidade indisponível" })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id)),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const teacherTurmas = new Map<string, Set<string>>();
  for (const turma of turmas) {
    for (const teacher of turma.professores) {
      if (!teacherTurmas.has(teacher.id)) teacherTurmas.set(teacher.id, new Set());
      teacherTurmas.get(teacher.id)!.add(turma.id);
    }
  }

  const professores = [...teacherTurmas.entries()].map(([id, ids]) => ({
    id,
    nome: teacherMap.get(id)?.nome ?? "Professor com vínculo registado · identidade indisponível",
    turmas: ids.size,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  // Keep currently inactive matrices visible as historical references; never
  // count them as the active curriculum or infer their state in the selected year.
  const activeCurriculum = new Map<string, DisciplinaCurriculumRow>();
  const inactiveCurriculum = new Map<string, DisciplinaCurriculumRow>();
  const seenActivities = new Map<string, Set<boolean>>();
  for (const row of input.curriculum) {
    if (!row.cursoId && !row.classeId) continue;
    const key = [row.cursoId ?? "", row.classeId ?? ""].join(":");
    const bucket = row.ativo === false ? inactiveCurriculum : activeCurriculum;
    if (!seenActivities.has(key)) seenActivities.set(key, new Set());
    if (row.ativo !== null && row.ativo !== undefined) seenActivities.get(key)!.add(row.ativo);
    if (!bucket.has(key)) bucket.set(key, row);
  }
  const byCourseAndClass = (a: DisciplinaCurriculumRow, b: DisciplinaCurriculumRow) =>
    (a.cursoNome ?? "").localeCompare(b.cursoNome ?? "", "pt") ||
    (a.classeNome ?? "").localeCompare(b.classeNome ?? "", "pt");
  const withVersionContext = (rows: Map<string, DisciplinaCurriculumRow>) =>
    [...rows.entries()].map(([key, row]) => ({
      ...row, hasOtherActivityVersion: (seenActivities.get(key)?.size ?? 0) > 1,
    })).sort(byCourseAndClass);
  const curriculo = withVersionContext(activeCurriculum);
  const curriculoHistorico = withVersionContext(inactiveCurriculum);
  return {
    professores,
    turmas,
    curriculo,
    curriculoHistorico,
    unresolvedTeacherLinks: unresolvedTeacherIds.size,
    stats: {
      professores: professores.length,
      turmas: turmas.length,
      cursos: new Set(curriculo.map((c) => c.cursoId).filter(Boolean)).size,
      classes: new Set(curriculo.map((c) => c.classeId).filter(Boolean)).size,
    },
  };
}

/** Only recognize a timetable assignment when its version is actually published. */
export function isPublishedDisciplinaVersion(status: string | null | undefined) {
  return status === "publicada";
}

/** Constrain search to literal school-catalog names/siglas, not PostgREST filter syntax. */
export function normalizeDisciplinaSearch(input: string): string {
  return input.normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 72);
}
