export type SchedulerDisciplineRulesInput = {
  entra_no_horario?: boolean | null;
  carga_horaria_semanal?: number | null;
};

export type ConflictSeverity = "hard" | "soft";

export type ConflictResult = {
  type: string;
  severity: ConflictSeverity;
  message: string;
  slotId: string;
  metadata?: Record<string, any>;
};

export const shouldAppearInScheduler = (disciplina: SchedulerDisciplineRulesInput) => {
  if (disciplina.entra_no_horario === false) return false;
  return true;
};

export const calculateTotalSlots = (disciplina: SchedulerDisciplineRulesInput) => {
  return Math.max(0, disciplina.carga_horaria_semanal ?? 0);
};

export const hasMissingLoad = (disciplina: SchedulerDisciplineRulesInput) => {
  return disciplina.entra_no_horario !== false && (disciplina.carga_horaria_semanal ?? 0) <= 0;
};

export const getAllocationStatus = (totalSlots: number, usedSlots: number, missingLoad = false) => {
  const remaining = Math.max(0, totalSlots - usedSlots);
  return {
    isComplete: !missingLoad && totalSlots > 0 && usedSlots >= totalSlots,
    isOverbooked: usedSlots > totalSlots,
    remaining,
    progress: totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0,
  };
};

/**
 * Validação de Conflitos no Frontend
 * 
 * Hard Conflicts (Bloqueantes):
 * - Colisão de Professor (mesmo professor em outra turma no mesmo slot)
 * - Colisão de Sala (mesma sala em outra turma no mesmo slot)
 * 
 * Soft Conflicts (Avisos):
 * - Carga horária excedida
 * - Concentração pedagógica (ex: muitas aulas da mesma matéria no dia) - TODO
 */
export const validateAssignment = (
  slotId: string,
  disciplinaId: string,
  professorId: string | null,
  salaId: string | null,
  existingAssignments: Array<{
    slot_id: string;
    professor_id: string | null;
    sala_id?: string | null;
  }> = []
): ConflictResult[] => {
  const conflicts: ConflictResult[] = [];

  for (const other of existingAssignments) {
    if (other.slot_id !== slotId) continue;

    // Conflito de Professor
    if (professorId && other.professor_id === professorId) {
      conflicts.push({
        type: "PROFESSOR_COLLISION",
        severity: "hard",
        message: "Professor já alocado neste horário em outra turma.",
        slotId,
      });
    }

    // Conflito de Sala
    if (salaId && other.sala_id === salaId) {
      conflicts.push({
        type: "SALA_COLLISION",
        severity: "hard",
        message: "Sala já ocupada neste horário.",
        slotId,
      });
    }
  }

  return conflicts;
};
