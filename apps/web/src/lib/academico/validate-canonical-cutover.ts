import {
  buildCanonicalMedCalendarPlan,
  CanonicalCalendarError,
  type CanonicalMedCalendar,
  type MedCourseProfile,
  type MedCourseOffering,
} from "./canonical-med-calendar";

export type CutoverTarget = {
  id: string;
  ano: number;
  data_inicio: string | null;
  data_fim: string | null;
};
export type RecordedPeriod = {
  numero: number | null;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  source_template_id: string | null;
  source_item_id: string | null;
  offering_id: string | null;
};
export type RecordedEvent = {
  offering_id: string | null;
  nome: string;
  data_inicio: string;
  tipo: string;
  source_template_id: string | null;
  source_item_id: string | null;
};
export type CutoverTargetReview = {
  ano: number;
  ano_letivo_id: string;
  ready: boolean;
  blockers: string[];
  periods: number;
  events: number;
  offerings: number;
};

/**
 * Fail-closed, read-only validation; never repairs calendars as a dry-run.
 * Call only with records scoped to the school and the target academic year.
 */
export function reviewCanonicalCutoverTarget(input: {
  target: CutoverTarget;
  calendar: CanonicalMedCalendar | null;
  profiles: MedCourseProfile[];
  offerings: MedCourseOffering[];
  selections: Array<{ offering_id: string; template_id: string }>;
  recordedPeriods: RecordedPeriod[];
  recordedEvents: RecordedEvent[];
}): CutoverTargetReview {
  const { target, calendar, profiles, offerings, selections, recordedPeriods, recordedEvents } = input;
  const blockers: string[] = [];
  const summary = () => ({
    ano: target.ano, ano_letivo_id: target.id,
    ready: blockers.length === 0, blockers,
    periods: recordedPeriods.length, events: recordedEvents.length,
    offerings: offerings.length,
  });
  if (target.ano < 2026) {
    blockers.push("O ano histórico exige uma verificação própria antes da virada.");
    return summary();
  }
  if (!calendar) {
    blockers.push(`O calendário MED ${target.ano}/${target.ano + 1} ainda não foi publicado.`);
    return summary();
  }
  if (target.data_inicio !== calendar.data_inicio || target.data_fim !== calendar.data_fim) {
    blockers.push("As datas do ano de destino divergem do calendário oficial.");
  }

  let plan: ReturnType<typeof buildCanonicalMedCalendarPlan> | null = null;
  try {
    plan = buildCanonicalMedCalendarPlan({ calendar, profiles, offerings, selections });
  } catch (e) {
    blockers.push(e instanceof CanonicalCalendarError ? e.message : "Não foi possível validar os perfis educativos.");
    return summary();
  }
  if (!plan) return summary();

  const expected = plan.periods;
  const validPeriodSources = profiles.flatMap((profile) => profile.items
    .filter((item) => item.tipo === "PERIODO_LETIVO")
    .map((item) => ({
      template: profile.id, item: item.id, numero: item.numero,
      data_inicio: item.data_inicio, data_fim: item.data_fim,
    })));
  if (recordedPeriods.length !== 3 || new Set(recordedPeriods.map((row) => row.numero)).size !== 3 ||
      recordedPeriods.some((period) => period.tipo !== "TRIMESTRE" || period.offering_id !== null ||
        !expected.some((item) => item.numero === period.numero &&
          item.data_inicio === period.data_inicio && item.data_fim === period.data_fim) ||
        !validPeriodSources.some((source) => source.template === period.source_template_id &&
          source.item === period.source_item_id && source.numero === period.numero &&
          source.data_inicio === period.data_inicio && source.data_fim === period.data_fim))) {
    blockers.push("Os três trimestres de destino não estão reconciliados com a fonte oficial.");
  }

  const eventKey = (item: {
    offering_id: string | null; nome: string; data_inicio: string;
    tipo: string; source_template_id: string | null; source_item_id: string | null;
  }) => JSON.stringify([
    item.offering_id, item.nome, item.data_inicio,
    item.tipo, item.source_template_id, item.source_item_id,
  ]);
  const found = new Set(recordedEvents.map(eventKey));
  const missing = plan.events.filter((event) => !found.has(eventKey(event)));
  if (missing.length > 0) {
    blockers.push(`Faltam ${missing.length} evento(s) do calendário oficial nas ofertas educativas.`);
  }
  const permitted = new Set(plan.events.map(eventKey));
  const obsolete = recordedEvents.filter((event) => event.source_template_id &&
    !permitted.has(eventKey(event)));
  if (obsolete.length > 0) {
    blockers.push(`Existem ${obsolete.length} evento(s) oficiais fora dos perfis dos cursos.`);
  }
  return summary();
}
