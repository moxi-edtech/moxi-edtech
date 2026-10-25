/** One read-only presentation contract for the already published school timetable.
 * Canonical data remains horario_versoes + quadro_horarios + horario_slots.
 */
export type PublishedLesson = Readonly<{
  id: string;
  diaSemana: number;
  inicio: string;
  fim: string;
  disciplinaNome: string;
  disciplinaId?: string | null;
  professorNome: string | null;
  professorVinculoRegistrado?: boolean;
  salaNome: string | null;
  turmaNome?: string | null;
}>;

export type PublishedTurmaHorario = Readonly<{
  turmaId: string;
  anoLetivoId: string;
  estado: "publicado" | "sem-publicacao";
  versaoId: string | null;
  publicadoEm: string | null;
  parcial: boolean;
  aulas: PublishedLesson[];
}>;

export const WEEKDAY_LABELS: Readonly<Record<number, string>> = {
  1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta",
  5: "Sexta", 6: "Sábado", 7: "Domingo",
};

export function sortPublishedLessons<T extends PublishedLesson>(aulas: readonly T[]): T[] {
  return [...aulas].sort((a, b) =>
    a.diaSemana - b.diaSemana
    || a.inicio.localeCompare(b.inicio)
    || a.fim.localeCompare(b.fim)
    || a.disciplinaNome.localeCompare(b.disciplinaNome)
    || a.id.localeCompare(b.id));
}

export function groupPublishedLessons(aulas: readonly PublishedLesson[]) {
  const byDay = new Map<number, PublishedLesson[]>();
  for (const lesson of sortPublishedLessons(aulas)) {
    if (!WEEKDAY_LABELS[lesson.diaSemana]) continue;
    const current = byDay.get(lesson.diaSemana) ?? [];
    current.push(lesson);
    byDay.set(lesson.diaSemana, current);
  }
  return [...byDay.entries()].map(([diaSemana, items]) => ({
    diaSemana, nome: WEEKDAY_LABELS[diaSemana], aulas: items,
  }));
}
