/**
 * One consistent, tenant-independent vocabulary for the five explorers.
 * Authorization, school and academic-year scoping are ALWAYS checked by API.
 */
export type AcademicYearRef = Readonly<{ id: string; ano: number }>;
export type YearLinkedEntity = Readonly<{ anoLetivoId: string | null; anoLetivo: number | null }>;

/** UUID is canonical; legacy numeric year is only a fallback. */
export function isEntityInAcademicYear(row: YearLinkedEntity, year: AcademicYearRef): boolean {
  return row.anoLetivoId ? row.anoLetivoId === year.id : row.anoLetivo === year.ano;
}

/** The year in which a classe was created is not the only year of use.
 * Relevance can also be proved by a school-scoped turma for the selected year.
 */
export function isClassInAcademicYear(
  classYearId: string | null, yearId: string, scopedTurmaCount: number,
): boolean {
  return !classYearId || classYearId === yearId || scopedTurmaCount > 0;
}

/** An active curriculum row takes precedence over any duplicate inactive row.
 * No relation is implied when both statuses are absent.
 */
export function mergeCurriculumActivity(
  previous: boolean | null | undefined, next: boolean | null | undefined,
): boolean | null {
  if (previous === true || next === true) return true;
  if (previous === false || next === false) return false;
  return null;
}

export type AcademicLinkEvidence = Readonly<{
  curriculumActive: boolean | null;
  assignedToTurma: boolean;
  teacherAssigned: boolean;
  schedulePublished: boolean;
  historicalYear: boolean;
}>;

export type AcademicLinkState =
  | "inactive-matrix"
  | "published"
  | "teacher-assigned"
  | "turma-assigned"
  | "curriculum-only"
  | "unconfirmed";

/** Descriptive, never a substitute for status or a promise that a lesson took place. */
export function academicLinkState(evidence: AcademicLinkEvidence): AcademicLinkState {
  // Operational evidence and the current curriculum state are independent.
  // Never hide a proven historical assignment behind an inactive matrix row.
  if (evidence.schedulePublished) return "published";
  if (evidence.teacherAssigned) return "teacher-assigned";
  if (evidence.assignedToTurma) return "turma-assigned";
  if (evidence.curriculumActive === false) return "inactive-matrix";
  if (evidence.curriculumActive === true) return "curriculum-only";
  return "unconfirmed";
}

/**
 * Current matrix activity must not be represented as the matrix's state in
 * a closed academic year. Keep it separate from the proven link status.
 */
export function academicCurriculumNotice(evidence: AcademicLinkEvidence): string | null {
  if (evidence.curriculumActive !== false) return null;
  return evidence.historicalYear
    ? "Matriz atualmente inativa · vínculo histórico preservado"
    : "Matriz inativa · verificar vínculo no ano selecionado";
}

/** Absence cannot be proved from a truncated set of associations. */
export function missingTeacherEvidenceLabel(partial: boolean): string {
  return partial
    ? "Professor não identificado nos vínculos consultados (lista parcial)"
    : "Professor não vinculado";
}

export const ACADEMIC_LINK_LABELS: Readonly<Record<AcademicLinkState, string>> = {
  "inactive-matrix": "Matriz curricular inativa · verificar vínculo",
  published: "Horário publicado",
  "teacher-assigned": "Professor atribuído",
  "turma-assigned": "Atribuída à turma",
  "curriculum-only": "Prevista na matriz",
  unconfirmed: "Origem do vínculo não confirmada",
};
