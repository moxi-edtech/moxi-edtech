import { isEntityInAcademicYear } from "./academic-relations";

/**
 * Pure, tenant-independent view-model composition. The API MUST filter and authorize
 * school, academic year, teacher, turmas and subject catalogue before calling this.
 */
export type ProfessorTurmaRow = {
  id: string;
  nome: string;
  turno: string | null;
  classeNome: string | null;
  cursoNome: string | null;
  anoLetivo: number | null;
  anoLetivoId: string | null;
};

export type ProfessorAllocation = {
  turmaId: string;
  disciplinaId: string | null;
};

export type ProfessorScheduleRow = {
  turmaId: string;
  disciplinaId: string | null;
  slotId: string;
  diaSemana: number;
  inicio: string;
  fim: string;
};

export type ProfessorSubject = { id: string; nome: string };

export function isPublishedTimetableVersion(status: string | null | undefined) {
  return status === "publicada";
}

export function belongsToProfessorAcademicYear(
  turma: Pick<ProfessorTurmaRow, "anoLetivo" | "anoLetivoId">,
  year: { id: string; ano: number },
) {
  return isEntityInAcademicYear(turma, year);
}

export function composeProfessorOverview(input: {
  turmas: ProfessorTurmaRow[];
  allocations: ProfessorAllocation[];
  schedule: ProfessorScheduleRow[];
  subjects: ProfessorSubject[];
}) {
  const turmaMap = new Map(input.turmas.map((turma) => [turma.id, turma]));
  const subjectMap = new Map(input.subjects.map((subject) => [subject.id, subject]));
  const turmaSubjects = new Map<string, Set<string>>();

  const ensureTurma = (id: string) => {
    if (!turmaMap.has(id)) return null;
    if (!turmaSubjects.has(id)) turmaSubjects.set(id, new Set<string>());
    return turmaSubjects.get(id)!;
  };

  for (const allocation of input.allocations) {
    const subjects = ensureTurma(allocation.turmaId);
    if (subjects && allocation.disciplinaId && subjectMap.has(allocation.disciplinaId)) {
      subjects.add(allocation.disciplinaId);
    }
  }

  const scheduleByKey = new Map<string, ProfessorScheduleRow>();
  for (const slot of input.schedule) {
    const subjects = ensureTurma(slot.turmaId);
    if (!subjects) continue;
    if (slot.disciplinaId && subjectMap.has(slot.disciplinaId)) subjects.add(slot.disciplinaId);
    if (!Number.isInteger(slot.diaSemana) || slot.diaSemana < 1 || slot.diaSemana > 7 || !slot.inicio || !slot.fim) continue;
    const key = [slot.turmaId, slot.slotId, slot.disciplinaId || ""].join(":");
    scheduleByKey.set(key, slot);
  }

  const turmas = Array.from(turmaSubjects.entries()).map(([id, subjectIds]) => {
    const turma = turmaMap.get(id)!;
    return {
      id,
      nome: turma.nome,
      turno: turma.turno,
      classeNome: turma.classeNome,
      cursoNome: turma.cursoNome,
      disciplinas: [...subjectIds].map((sid) => subjectMap.get(sid)!)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const subjectTurmaCounts = new Map<string, Set<string>>();
  for (const turma of turmas) {
    for (const disciplina of turma.disciplinas) {
      if (!subjectTurmaCounts.has(disciplina.id)) subjectTurmaCounts.set(disciplina.id, new Set());
      subjectTurmaCounts.get(disciplina.id)!.add(turma.id);
    }
  }
  const disciplinas = [...subjectTurmaCounts.entries()]
    .map(([id, turmaIds]) => ({ ...subjectMap.get(id)!, turmas: turmaIds.size }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.id.localeCompare(b.id));

  const horarios = [...scheduleByKey.values()].map((row) => ({
    turmaId: row.turmaId,
    turmaNome: turmaMap.get(row.turmaId)!.nome,
    disciplinaNome: row.disciplinaId ? subjectMap.get(row.disciplinaId)?.nome ?? null : null,
    diaSemana: row.diaSemana,
    inicio: row.inicio,
    fim: row.fim,
  })).sort((a, b) => a.diaSemana - b.diaSemana ||
    a.inicio.localeCompare(b.inicio) || a.turmaNome.localeCompare(b.turmaNome));

  return { turmas, disciplinas, horarios,
    stats: { turmas: turmas.length, disciplinas: disciplinas.length, aulasPublicadas: horarios.length } };
}

/** In KLASSE horario_slots 1=segunda, through 7=domingo. */
export const PROFESSOR_WEEKDAYS = [
  "", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo",
] as const;
