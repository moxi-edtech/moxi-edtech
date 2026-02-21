export type SchedulerDisciplineRulesInput = {
  entra_no_horario?: boolean | null;
  carga_horaria_semanal?: number | null;
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
