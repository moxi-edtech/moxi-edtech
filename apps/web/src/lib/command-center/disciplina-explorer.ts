import { belongsToProfessorAcademicYear } from "./professor-explorer";

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
  cursoId: string | null;
  cursoNome: string | null;
  classeId: string | null;
  classeNome: string | null;
  cargaHorariaSemanal: number | null;
  obrigatoria: boolean | null;
};

/** Never extrapolate across years from a legacy numeric year when an ID is present. */
export function isDisciplinaTurmaInYear(
  turma: Pick<DisciplinaTurmaRow, "anoLetivo" | "anoLetivoId">,
  academicYear: { id: string; ano: number },
) {
  return belongsToProfessorAcademicYear(turma, academicYear);
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
  const assignmentsByTurma = new Map<string, Set<string>>();

  for (const row of input.assignments) {
    if (!availableTurmas.has(row.turmaId)) continue;
    if (!assignmentsByTurma.has(row.turmaId)) assignmentsByTurma.set(row.turmaId, new Set());
    if (row.professorId && teacherMap.has(row.professorId)) {
      assignmentsByTurma.get(row.turmaId)!.add(row.professorId);
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
      professores: [...ids].map((id) => teacherMap.get(id)!)
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
    nome: teacherMap.get(id)!.nome,
    turmas: ids.size,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  // Course curriculum is a *reference*, not an indicator of teaching in this year.
  const uniqueCurriculum = new Map<string, DisciplinaCurriculumRow>();
  for (const row of input.curriculum) {
    if (!row.cursoId && !row.classeId) continue;
    const key = [row.cursoId ?? "", row.classeId ?? ""].join(":");
    if (!uniqueCurriculum.has(key)) uniqueCurriculum.set(key, row);
  }
  const curriculo = [...uniqueCurriculum.values()].sort((a, b) =>
    (a.cursoNome ?? "").localeCompare(b.cursoNome ?? "", "pt") ||
    (a.classeNome ?? "").localeCompare(b.classeNome ?? "", "pt"));
  return {
    professores,
    turmas,
    curriculo,
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
