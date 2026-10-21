import { belongsToProfessorAcademicYear } from "./professor-explorer";
import { turmaEnrollmentPolicy } from "./turma-explorer-policy";

export type ClasseTurma = {
  id: string;
  nome: string;
  turno: string | null;
  sala: string | null;
  capacidade: number | null;
  cursoId: string | null;
  anoLetivo: number | null;
  anoLetivoId: string | null;
};
export type ClasseEnrollment = {
  id: string;
  turmaId: string;
  alunoId: string;
  nome: string;
  numeroChamada: number | null;
};
export type ClasseCurriculum = {
  id: string;
  disciplinaId: string;
  cargaHorariaSemanal: number | null;
  obrigatoria: boolean | null;
};
export type ClasseAssignment = {
  turmaId: string;
  disciplinaId: string | null;
  professorId: string | null;
};
export type ClasseNamedEntity = { id: string; nome: string };

/** School-scoped classe may be reused each year; turmas are year-scoped. */
export function isClasseTurmaInYear(
  turma: Pick<ClasseTurma, "anoLetivo" | "anoLetivoId">,
  year: { id: string; ano: number },
) {
  return belongsToProfessorAcademicYear(turma, year);
}

/**
 * Classes can be reused across years even when their recorded ano_letivo_id
 * differs. Actual turmas in the requested year prove the class is relevant.
 */
export function isClasseAvailableInYear(
  classeAnoLetivoId: string | null,
  resolvedAnoLetivoId: string,
  eligibleTurmas: readonly Pick<ClasseTurma, "id">[],
) {
  return !classeAnoLetivoId ||
    classeAnoLetivoId === resolvedAnoLetivoId ||
    eligibleTurmas.length > 0;
}

export function classeEnrollmentStatuses(historical: boolean) {
  return turmaEnrollmentPolicy(historical);
}

export function classePageRange(page: number, size = 20) {
  if (!Number.isInteger(page) || page < 1 || page > 10000 ||
    !Number.isInteger(size) || size < 1 || size > 100) {
    throw new RangeError("Invalid class student page.");
  }
  return { from: (page - 1) * size, to: page * size - 1 };
}

/**
 * Authorization, RLS, the academic year, matricula status, published timetable
 * and school-scoped joins are checked by the API before calling this function.
 * The class roster is deduplicated by aluno_id even if enrollment rows repeat.
 */
export function composeClasseOverview(input: {
  year: { id: string; ano: number };
  turmas: ClasseTurma[];
  enrollments: ClasseEnrollment[];
  curriculum: ClasseCurriculum[];
  assignments: ClasseAssignment[];
  subjects: ClasseNamedEntity[];
  teachers: ClasseNamedEntity[];
  page: number;
  pageSize?: number;
}) {
  const turmas = new Map(input.turmas
    .filter((turma) => isClasseTurmaInYear(turma, input.year))
    .map((turma) => [turma.id, turma] as const));
  const subjectNames = new Map(input.subjects.map((subject) => [subject.id, subject.nome] as const));
  const teacherNames = new Map(input.teachers.map((teacher) => [teacher.id, teacher.nome] as const));

  const studentByTurma = new Map<string, Map<string, ClasseEnrollment>>();
  const studentsUnique = new Map<string, ClasseEnrollment>();
  for (const turmaId of turmas.keys()) studentByTurma.set(turmaId, new Map());

  // Deterministic choice for a student with multiple enrollment rows.
  const sortedEnrollments = [...input.enrollments].sort((a, b) =>
    a.turmaId.localeCompare(b.turmaId) || a.id.localeCompare(b.id));
  for (const enrollment of sortedEnrollments) {
    const byTurma = studentByTurma.get(enrollment.turmaId);
    if (!byTurma || !enrollment.alunoId) continue;
    if (!byTurma.has(enrollment.alunoId)) byTurma.set(enrollment.alunoId, enrollment);
    if (!studentsUnique.has(enrollment.alunoId)) studentsUnique.set(enrollment.alunoId, enrollment);
  }

  const subjectsByTurma = new Map<string, Set<string>>();
  const teachersByTurma = new Map<string, Set<string>>();
  const turmasBySubject = new Map<string, Set<string>>();
  const turmasByTeacher = new Map<string, Set<string>>();
  const subjectsByTeacher = new Map<string, Set<string>>();

  for (const turmaId of turmas.keys()) {
    subjectsByTurma.set(turmaId, new Set());
    teachersByTurma.set(turmaId, new Set());
  }
  const availableCurriculum = new Map(
    input.curriculum.filter((item) => subjectNames.has(item.disciplinaId))
      .map((item) => [item.id, item] as const),
  );
  for (const assignment of input.assignments) {
    if (!turmas.has(assignment.turmaId)) continue;
    const { turmaId, disciplinaId, professorId } = assignment;
    if (disciplinaId && subjectNames.has(disciplinaId)) {
      subjectsByTurma.get(turmaId)!.add(disciplinaId);
      if (!turmasBySubject.has(disciplinaId)) turmasBySubject.set(disciplinaId, new Set());
      turmasBySubject.get(disciplinaId)!.add(turmaId);
    }
    if (professorId && teacherNames.has(professorId)) {
      teachersByTurma.get(turmaId)!.add(professorId);
      if (!turmasByTeacher.has(professorId)) turmasByTeacher.set(professorId, new Set());
      turmasByTeacher.get(professorId)!.add(turmaId);
      if (disciplinaId && subjectNames.has(disciplinaId)) {
        if (!subjectsByTeacher.has(professorId)) subjectsByTeacher.set(professorId, new Set());
        subjectsByTeacher.get(professorId)!.add(disciplinaId);
      }
    }
  }

  const turmaItems = [...turmas.values()].map((turma) => ({
    id: turma.id,
    nome: turma.nome,
    turno: turma.turno,
    sala: turma.sala,
    capacidade: turma.capacidade,
    alunos: studentByTurma.get(turma.id)?.size ?? 0,
    professores: teachersByTurma.get(turma.id)?.size ?? 0,
    disciplinas: subjectsByTurma.get(turma.id)?.size ?? 0,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const curriculumIds = new Set([...availableCurriculum.values()].map((item) => item.disciplinaId));
  const disciplinaIds = new Set([...curriculumIds, ...turmasBySubject.keys()]);
  const disciplinas = [...disciplinaIds].filter((id) => subjectNames.has(id)).map((id) => {
    const rows = [...availableCurriculum.values()].filter((item) => item.disciplinaId === id);
    return {
      id,
      nome: subjectNames.get(id)!,
      cargaHorariaSemanal: rows.find((row) => row.cargaHorariaSemanal != null)?.cargaHorariaSemanal ?? null,
      obrigatoria: rows.some((row) => row.obrigatoria === true),
      turmas: turmasBySubject.get(id)?.size ?? 0,
      naMatriz: rows.length > 0,
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const professores = [...turmasByTeacher.entries()].map(([id, turmaIds]) => ({
    id,
    nome: teacherNames.get(id)!,
    turmas: turmaIds.size,
    disciplinas: subjectsByTeacher.get(id)?.size ?? 0,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const sortedStudents = [...studentsUnique.values()].map((student) => ({
    id: student.alunoId,
    nome: student.nome,
    turmaId: student.turmaId,
    turmaNome: turmas.get(student.turmaId)!.nome,
    numeroChamada: student.numeroChamada,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const pageSize = input.pageSize ?? 20;
  const { from, to } = classePageRange(input.page, pageSize);
  const capacityKnown = turmaItems.every((turma) => turma.capacidade != null);
  return {
    stats: {
      turmas: turmaItems.length,
      alunos: sortedStudents.length,
      capacidade: capacityKnown
        ? turmaItems.reduce((sum, turma) => sum + (turma.capacidade ?? 0), 0)
        : null,
      disciplinas: disciplinas.length,
      professores: professores.length,
    },
    turmas: turmaItems,
    disciplinas,
    professores,
    alunos: {
      items: sortedStudents.slice(from, to + 1),
      total: sortedStudents.length,
      page: input.page,
      pageSize,
      hasMore: to + 1 < sortedStudents.length,
    },
  };
}
