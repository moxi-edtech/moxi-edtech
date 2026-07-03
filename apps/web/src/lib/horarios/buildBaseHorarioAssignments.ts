type BaseScheduleSubject = {
  disciplinaId: string;
  professorId?: string | null;
  cargaSemanal: number;
  requiresDouble?: boolean;
  isPractical?: boolean;
};

type BaseScheduleSlot = {
  id: string;
  day: number;
  ordem: number;
  isIntervalo?: boolean;
};

type ScheduleCandidate = BaseScheduleSubject & {
  target: number;
  remaining: number;
  assigned: number;
  doubleBlocksTarget: number;
  doubleBlocksPlaced: number;
};

export type BaseHorarioAssignment = {
  slotId: string;
  disciplinaId: string;
  professorId: string | null;
};

function sortSlots(slots: BaseScheduleSlot[]) {
  return [...slots]
    .filter((slot) => !slot.isIntervalo)
    .sort((a, b) => (a.day - b.day) || (a.ordem - b.ordem));
}

function chooseCandidate({
  candidates,
  assignedToday,
  previousDisciplinaId,
}: {
  candidates: ScheduleCandidate[];
  assignedToday: Map<string, number>;
  previousDisciplinaId: string | null;
}) {
  return [...candidates].sort((a, b) => {
    const aToday = assignedToday.get(a.disciplinaId) || 0;
    const bToday = assignedToday.get(b.disciplinaId) || 0;
    const aRatio = a.target > 0 ? a.assigned / a.target : a.assigned;
    const bRatio = b.target > 0 ? b.assigned / b.target : b.assigned;
    const aPrevPenalty = previousDisciplinaId === a.disciplinaId ? 1 : 0;
    const bPrevPenalty = previousDisciplinaId === b.disciplinaId ? 1 : 0;
    const aNeedsPair = a.doubleBlocksPlaced < a.doubleBlocksTarget ? 1 : 0;
    const bNeedsPair = b.doubleBlocksPlaced < b.doubleBlocksTarget ? 1 : 0;

    if (aNeedsPair !== bNeedsPair) return bNeedsPair - aNeedsPair;
    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
    if (aToday !== bToday) return aToday - bToday;
    if (aRatio !== bRatio) return aRatio - bRatio;
    if (aPrevPenalty !== bPrevPenalty) return aPrevPenalty - bPrevPenalty;
    return a.disciplinaId.localeCompare(b.disciplinaId);
  })[0] ?? null;
}

function getNextSlotSameDay(slots: BaseScheduleSlot[], index: number) {
  const current = slots[index];
  const next = slots[index + 1];
  if (!current || !next) return null;
  if (current.day !== next.day) return null;
  return next;
}

export function buildBaseHorarioAssignments(
  subjects: BaseScheduleSubject[],
  slots: BaseScheduleSlot[],
): BaseHorarioAssignment[] {
  const activeSlots = sortSlots(slots);
  const candidates: ScheduleCandidate[] = subjects
    .map((subject) => {
      const target = Math.max(0, Number(subject.cargaSemanal || 0));
      return {
        ...subject,
        target,
        remaining: target,
        assigned: 0,
        doubleBlocksTarget: subject.isPractical
          ? Math.floor(target / 2)
          : subject.requiresDouble
            ? Math.min(1, Math.floor(target / 2))
            : 0,
        doubleBlocksPlaced: 0,
      };
    })
    .filter((subject) => subject.disciplinaId);

  if (activeSlots.length === 0 || candidates.length === 0) return [];

  const assignments: BaseHorarioAssignment[] = [];
  let currentDay = activeSlots[0]?.day ?? 1;
  let assignedToday = new Map<string, number>();
  let previousDisciplinaId: string | null = null;

  for (let index = 0; index < activeSlots.length; index += 1) {
    const slot = activeSlots[index];
    if (slot.day !== currentDay) {
      currentDay = slot.day;
      assignedToday = new Map<string, number>();
      previousDisciplinaId = null;
    }

    const withRemaining = candidates.filter((candidate) => candidate.remaining > 0);
    const pool = withRemaining.length > 0 ? withRemaining : candidates;
    const chosen = chooseCandidate({
      candidates: pool,
      assignedToday,
      previousDisciplinaId,
    });

    if (!chosen) continue;

    const assignedForDay = assignedToday.get(chosen.disciplinaId) || 0;
    const nextSlot = getNextSlotSameDay(activeSlots, index);
    const wantsDoubleBlock =
      chosen.remaining >= 2 &&
      chosen.doubleBlocksPlaced < chosen.doubleBlocksTarget &&
      assignedForDay === 0 &&
      nextSlot;

    assignments.push({
      slotId: slot.id,
      disciplinaId: chosen.disciplinaId,
      professorId: chosen.professorId ?? null,
    });

    chosen.assigned += 1;
    if (chosen.remaining > 0) chosen.remaining -= 1;
    assignedToday.set(chosen.disciplinaId, (assignedToday.get(chosen.disciplinaId) || 0) + 1);
    previousDisciplinaId = chosen.disciplinaId;

    if (wantsDoubleBlock && nextSlot) {
      assignments.push({
        slotId: nextSlot.id,
        disciplinaId: chosen.disciplinaId,
        professorId: chosen.professorId ?? null,
      });
      chosen.assigned += 1;
      if (chosen.remaining > 0) chosen.remaining -= 1;
      chosen.doubleBlocksPlaced += 1;
      assignedToday.set(chosen.disciplinaId, (assignedToday.get(chosen.disciplinaId) || 0) + 1);
      previousDisciplinaId = chosen.disciplinaId;
      index += 1;
    }
  }

  return assignments;
}
