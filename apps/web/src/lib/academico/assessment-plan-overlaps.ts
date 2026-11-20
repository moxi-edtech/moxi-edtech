/**
 * Pré-validação de interface para a mesma regra temporal que o PostgreSQL
 * aplica com EXCLUDE USING gist em calendario_avaliacoes.
 * A base de dados continua a ser a autoridade sob concorrência.
 */
export type AssessmentScheduleSlot = {
  id: string;
  turma_id: string;
  data: string;
  inicio: string;
  fim: string | null;
  estado?: string;
};

export type AssessmentScheduleOverlap = {
  withId: string;
  source: "existing" | "selection";
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function boundary(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !TIME.test(time)) return null;
  const midnight = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) return null;
  const match = TIME.exec(time);
  if (!match) return null;
  return midnight.getTime()
    + (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) * 1000;
}

export function assessmentSlotsOverlap(a: AssessmentScheduleSlot, b: AssessmentScheduleSlot): boolean {
  if (a.turma_id !== b.turma_id || a.estado === "cancelado" || b.estado === "cancelado") return false;
  const startA = boundary(a.data, a.inicio);
  const startB = boundary(b.data, b.inicio);
  if (startA === null || startB === null) return false;
  const endA = a.fim ? boundary(a.data, a.fim) : startA + 60 * 60 * 1000;
  const endB = b.fim ? boundary(b.data, b.fim) : startB + 60 * 60 * 1000;
  if (endA === null || endB === null || endA <= startA || endB <= startB) return false;
  return startA < endB && startB < endA;
}

/** Cada linha aponta para os outros registos que impedem a sua criação. */
export function assessmentPlanOverlaps(
  selection: AssessmentScheduleSlot[],
  existing: AssessmentScheduleSlot[],
): Record<string, AssessmentScheduleOverlap[]> {
  const issues: Record<string, AssessmentScheduleOverlap[]> = {};
  for (const item of selection) {
    const overlaps: AssessmentScheduleOverlap[] = [];
    for (const stored of existing) {
      if (stored.id !== item.id && assessmentSlotsOverlap(item, stored)) {
        overlaps.push({ withId: stored.id, source: "existing" });
      }
    }
    for (const other of selection) {
      if (other.id !== item.id && assessmentSlotsOverlap(item, other)) {
        overlaps.push({ withId: other.id, source: "selection" });
      }
    }
    if (overlaps.length) issues[item.id] = overlaps;
  }
  return issues;
}
