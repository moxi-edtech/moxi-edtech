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

export type DisciplinaTeacher = { id: string; nome: string; identityAvailable?: boolean };
export type DisciplinaAssignment = { turmaId: string; professorId: string | null };
export type PublishedCourseCurriculum = {
  id: string;
  cursoId: string;
  classeId: string | null;
  anoLetivoId: string;
  version: number;
  status: string;
};

export class PublishedCurriculumConflictError extends Error {
  constructor() {
    super("Múltiplas versões curriculares publicadas no mesmo âmbito.");
    this.name = "PublishedCurriculumConflictError";
  }
}

/** Never select an archived or cross-year version, nor silently choose a conflicting publication. */
export function indexPublishedCurricula(
  versions: PublishedCourseCurriculum[], yearId: string,
): Map<string, PublishedCourseCurriculum> {
  const selected = new Map<string, PublishedCourseCurriculum>();
  for (const version of versions) {
    if (version.anoLetivoId !== yearId || version.status !== "published") continue;
    const key = [version.cursoId, version.classeId ?? ""].join(":");
    if (selected.has(key)) throw new PublishedCurriculumConflictError();
    selected.set(key, version);
  }
  return selected;
}

export type DisciplinaCurriculumRow = {
  id: string;
  curriculoId: string;
  curriculoVersao: number;
  cursoId: string | null;
  cursoNome: string | null;
  classeId: string | null;
  classeNome: string | null;
  cargaHorariaSemanal: number | null;
  obrigatoria: boolean | null;
  /** Current activity, not a historical snapshot. */
  ativo: boolean | null;
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
      if (teacherMap.get(row.professorId)?.identityAvailable === false ||
          !teacherMap.has(row.professorId)) unresolvedTeacherIds.add(row.professorId);
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
      professores: [...ids].map((id) => teacherMap.get(id) ?? {
        id, nome: "Professor com vínculo registado · identidade indisponível", identityAvailable: false,
      })
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

  // Unresolved professor IDs remain attached to their turmas as evidence,
  // but must not be counted as verified identities or linked to an unavailable profile.
  const professores = [...teacherTurmas.entries()]
    .filter(([id]) => teacherMap.has(id) && teacherMap.get(id)?.identityAvailable !== false)
    .map(([id, ids]) => ({
      id,
      nome: teacherMap.get(id)!.nome,
      turmas: ids.size,
    })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  // The API supplies only the published curriculum for the selected year.
  // Deduplicate identical course/class/discipline rows within that version,
  // never by activity across versions. Preserve inactive rows inline.
  const curriculoByScope = new Map<string, DisciplinaCurriculumRow>();
  for (const row of input.curriculum) {
    const key = [row.curriculoId, row.cursoId ?? "", row.classeId ?? ""].join(":");
    if (!curriculoByScope.has(key)) curriculoByScope.set(key, row);
  }
  const curriculo = [...curriculoByScope.values()].sort((a, b) =>
    (a.cursoNome ?? "").localeCompare(b.cursoNome ?? "", "pt") ||
    (a.classeNome ?? "").localeCompare(b.classeNome ?? "", "pt") ||
    a.id.localeCompare(b.id));

  return {
    professores,
    turmas,
    curriculo,
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
