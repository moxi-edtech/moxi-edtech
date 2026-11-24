export type LessonSlot = { id: string; dia_semana: number; inicio: string; fim: string };
export type LessonAssignment = { slot_id: string; professor_id?: string | null; sala_id?: string | null };

function seconds(time: string): number {
  const [h, m, s = "0"] = time.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Half-open intervals: an aula ending at 14:00 does not collide with one starting at 14:00.
export function slotsOverlap(a: LessonSlot, b: LessonSlot): boolean {
  return a.dia_semana === b.dia_semana && seconds(a.inicio) < seconds(b.fim) && seconds(b.inicio) < seconds(a.fim);
}

export function resourceConflicts(
  proposed: LessonAssignment[],
  published: LessonAssignment[],
  slots: ReadonlyMap<string, LessonSlot>,
) {
  const conflicts: Array<{ slot_id: string; professor_id?: string | null; sala_id?: string | null; kind: "professor" | "sala" }> = [];
  const seen = new Set<string>();
  for (const item of proposed) {
    const current = slots.get(item.slot_id);
    if (!current) continue;
    for (const other of published) {
      const existing = slots.get(other.slot_id);
      if (!existing || !slotsOverlap(current, existing)) continue;
      if (item.professor_id && item.professor_id === other.professor_id) {
        const key = `${item.slot_id}:professor:${item.professor_id}`;
        if (!seen.has(key)) conflicts.push({ slot_id: item.slot_id, professor_id: item.professor_id, kind: "professor" });
        seen.add(key);
      }
      if (item.sala_id && item.sala_id === other.sala_id) {
        const key = `${item.slot_id}:sala:${item.sala_id}`;
        if (!seen.has(key)) conflicts.push({ slot_id: item.slot_id, sala_id: item.sala_id, kind: "sala" });
        seen.add(key);
      }
    }
  }
  return conflicts;
}
