/**
 * Um evento partilhado pode existir uma única vez no calendário da escola,
 * com a proveniência de um dos subsistemas. A sua elegibilidade noutro
 * subsistema é determinada pela correspondência exacta com o item publicado
 * do respectivo calendário, nunca só por source_template_id.
 */
export type SchoolCalendarEvent = {
  id: string;
  nome: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  offering_id: string | null;
};

export type SchoolCalendarTemplateItem = {
  tipo: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  applies_to_all_offerings?: boolean | null;
  grade_codes?: string[] | null;
};

function key(input: Pick<SchoolCalendarEvent, "nome" | "tipo" | "data_inicio" | "data_fim">) {
  return JSON.stringify([input.tipo, input.nome, input.data_inicio, input.data_fim]);
}

export function selectApplicableOfficialEvents<T extends SchoolCalendarEvent>(
  events: T[],
  items: SchoolCalendarTemplateItem[],
  offeringIds: string[],
  gradeCode?: string | null,
  isExamClass = false,
): T[] {
  const offeringSet = new Set(offeringIds);
  const accepted = new Map<string, SchoolCalendarTemplateItem[]>();

  for (const item of items) {
    if (item.tipo === "PERIODO_LETIVO") continue;
    // O modelo MED de 2026/27 ainda não marca classes nas datas de exames
    // nacionais; a turma de exame é o fallback já registado na escola.
    if (item.tipo.startsWith("EXAME_") && !item.grade_codes?.length && !isExamClass) continue;
    if (item.grade_codes?.length && (!gradeCode || !item.grade_codes.includes(gradeCode))) continue;
    const k = key(item);
    const existing = accepted.get(k) ?? [];
    existing.push(item);
    accepted.set(k, existing);
  }

  return events.filter((event) => {
    const possible = accepted.get(key(event));
    if (!possible) return false;
    if (event.offering_id && !offeringSet.has(event.offering_id)) return false;
    return possible.some((item) =>
      item.applies_to_all_offerings !== false ||
      (event.offering_id !== null && offeringSet.has(event.offering_id))
    );
  });
}
