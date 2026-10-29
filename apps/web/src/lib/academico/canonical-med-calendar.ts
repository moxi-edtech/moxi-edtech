/**
 * One official MED calendar per year; profiles are course-level variations,
 * not independent sources of teaching dates. Pure planning: callers persist
 * only after the complete mapping is validated.
 */
export type CanonicalMedCalendar = {
  ano_base: number;
  data_inicio: string;
  data_fim: string;
  versao_documento: string;
  estado: string;
};

export type MedProfileItem = {
  id: string;
  tipo: string;
  numero: number | null;
  nome: string;
  data_inicio: string;
  data_fim: string;
  peso: number | null;
  applies_to_all_offerings?: boolean;
  education_subsystems?: string[];
  education_levels?: string[];
  cycles?: string[];
  grade_codes?: string[];
  course_types?: string[];
};

export type MedCourseProfile = {
  id: string;
  ano_base: number;
  calendario_canonico_ano: number | null;
  data_inicio: string;
  data_fim: string;
  subsistema: string | null;
  is_oficial?: boolean | null;
  estado?: string;
  versao_documento: string | null;
  items: MedProfileItem[];
};

export type MedCourseOffering = {
  id: string;
  course_id: string | null;
  education_subsystem: string;
  education_level: string;
  cycle: string | null;
  grades: string[] | null;
};

export type CourseCalendarSelection = { offering_id: string; template_id: string };

export class CanonicalCalendarError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CanonicalCalendarError";
  }
}

function invalid(code: string, message: string): never {
  throw new CanonicalCalendarError(code, message);
}

function termKey(items: readonly MedProfileItem[]): string {
  const teaching = items.filter((item) => item.tipo === "PERIODO_LETIVO")
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  if (teaching.length !== 3 || teaching.some((term, index) =>
    term.numero !== index + 1 || !term.id || term.data_inicio > term.data_fim)) {
    return invalid("OFFICIAL_TRIMESTERS_INCOMPLETE", "O calendário oficial deve ter três trimestres distintos.");
  }
  return JSON.stringify(teaching.map((term) =>
    [term.numero, term.data_inicio, term.data_fim, term.peso]));
}

function itemMatchesCourse(item: MedProfileItem, offering: MedCourseOffering): boolean {
  if (item.applies_to_all_offerings !== false) return true;
  const hasFilter = Boolean(
    item.education_subsystems?.length || item.education_levels?.length ||
    item.cycles?.length || item.grade_codes?.length || item.course_types?.length
  );
  if (!hasFilter) return false;
  if (item.education_subsystems?.length &&
      !item.education_subsystems.includes(offering.education_subsystem)) return false;
  if (item.education_levels?.length &&
      !item.education_levels.includes(offering.education_level)) return false;
  if (item.cycles?.length && (!offering.cycle || !item.cycles.includes(offering.cycle))) return false;
  if (item.grade_codes?.length &&
      !(offering.grades ?? []).some((grade) => item.grade_codes?.includes(grade))) return false;
  return true;
}

export function buildCanonicalMedCalendarPlan(input: {
  calendar: CanonicalMedCalendar;
  profiles: readonly MedCourseProfile[];
  offerings: readonly MedCourseOffering[];
  selections: readonly CourseCalendarSelection[];
}) {
  const { calendar, profiles, offerings, selections } = input;
  if (calendar.ano_base < 2026 || calendar.estado !== "PUBLICADO") {
    invalid("OFFICIAL_CALENDAR_NOT_PUBLISHED", "O calendário académico oficial ainda não foi publicado.");
  }
  if (offerings.length === 0 ||
      selections.length !== offerings.length ||
      new Set(selections.map((item) => item.offering_id)).size !== offerings.length) {
    invalid("COURSE_CALENDAR_MAPPING_INCOMPLETE", "Associe um perfil do calendário a cada curso.");
  }
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile] as const));
  const mappings = new Map(selections.map((item) => [item.offering_id, item.template_id] as const));
  const validated: Array<{ offering: MedCourseOffering; profile: MedCourseProfile }> = [];
  let matchingTerms: string | null = null;

  for (const offering of offerings) {
    const selected = mappings.get(offering.id);
    const profile = selected && profilesById.get(selected);
    if (!profile || profile.ano_base !== calendar.ano_base ||
        profile.calendario_canonico_ano !== calendar.ano_base ||
        profile.subsistema !== offering.education_subsystem ||
        profile.is_oficial !== true || profile.estado !== "PUBLICADO" ||
        profile.data_inicio !== calendar.data_inicio ||
        profile.data_fim !== calendar.data_fim ||
        profile.versao_documento !== calendar.versao_documento) {
      invalid("COURSE_CALENDAR_PROFILE_MISMATCH", "O perfil do curso não pertence ao calendário deste ano.");
    }
    const periods = termKey(profile.items);
    if (matchingTerms !== null && matchingTerms !== periods) {
      invalid("ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE", "Os perfis divergem nas datas dos trimestres.");
    }
    matchingTerms = periods;
    validated.push({ offering, profile });
  }

  // All profiles share one term contract. A stable profile is used solely
  // for the legacy source_item_id foreign keys, not as a separate year SSOT.
  const source = [...validated].sort((a, b) => a.profile.id.localeCompare(b.profile.id))[0].profile;
  const periods = source.items
    .filter((item) => item.tipo === "PERIODO_LETIVO")
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((item) => ({
      numero: Number(item.numero),
      tipo: "TRIMESTRE" as const,
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
      peso: item.peso,
      source_template_id: source.id,
      source_item_id: item.id,
      source_version: calendar.versao_documento,
    }));

  type PlannedEvent = {
    offering_id: string | null;
    tipo: string;
    nome: string;
    data_inicio: string;
    data_fim: string;
    source_template_id: string;
    source_item_id: string;
    source_version: string;
  };

  const individual = validated.flatMap(({ offering, profile }) => profile.items
    .filter((item) => item.tipo !== "PERIODO_LETIVO" && itemMatchesCourse(item, offering))
    .map((item) => ({
      offering_id: offering.id,
      tipo: item.tipo, nome: item.nome,
      data_inicio: item.data_inicio, data_fim: item.data_fim,
      source_template_id: profile.id, source_item_id: item.id,
      source_version: calendar.versao_documento,
      // Explicit filters never turn an event into a shared school event.
      globallyApplicable: item.applies_to_all_offerings !== false,
    })));

  const keyOf = (item: Pick<PlannedEvent, "tipo" | "nome" | "data_inicio" | "data_fim">) =>
    JSON.stringify([item.tipo, item.nome, item.data_inicio, item.data_fim]);
  const globalCounts = new Map<string, Set<string>>();
  for (const event of individual) {
    if (!event.globallyApplicable) continue;
    const key = keyOf(event);
    const owners = globalCounts.get(key) ?? new Set<string>();
    owners.add(event.offering_id);
    globalCounts.set(key, owners);
  }
  const events: PlannedEvent[] = [];
  const seen = new Set<string>();
  for (const event of individual) {
    const global = event.globallyApplicable &&
      globalCounts.get(keyOf(event))?.size === offerings.length;
    const offeringId = global ? null : event.offering_id;
    const uniquenessKey = JSON.stringify([offeringId, event.nome, event.data_inicio]);
    const exactKey = JSON.stringify([offeringId, event.tipo, event.nome, event.data_inicio, event.data_fim]);
    if (seen.has(exactKey)) continue;
    // A given offer cannot have two different normative events with the
    // same title/start: the DB uniqueness key would collapse them silently.
    if (events.some((item) => JSON.stringify([item.offering_id, item.nome, item.data_inicio]) === uniquenessKey)) {
      invalid("CALENDAR_EVENT_COLLISION", "Eventos oficiais incompatíveis partilham o mesmo nome e data.");
    }
    events.push({
      offering_id: offeringId,
      tipo: event.tipo,
      nome: event.nome,
      data_inicio: event.data_inicio, data_fim: event.data_fim,
      source_template_id: event.source_template_id,
      source_item_id: event.source_item_id,
      source_version: event.source_version,
    });
    seen.add(exactKey);
  }

  return { calendar, periods, events, selections, courseCount: offerings.length };
}
