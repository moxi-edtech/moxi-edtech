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
  course_type?: string | null;
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
  const hasFilter = Boolean(
    item.education_subsystems?.length || item.education_levels?.length ||
    item.cycles?.length || item.grade_codes?.length || item.course_types?.length
  );
  if (!hasFilter) return item.applies_to_all_offerings !== false;
  if (item.education_subsystems?.length &&
      !item.education_subsystems.includes(offering.education_subsystem)) return false;
  if (item.education_levels?.length &&
      !item.education_levels.includes(offering.education_level)) return false;
  if (item.cycles?.length && (!offering.cycle || !item.cycles.includes(offering.cycle))) return false;
  if (item.grade_codes?.length &&
      !(offering.grades ?? []).some((grade) => item.grade_codes?.includes(grade))) return false;
  if (item.course_types?.length &&
      (!offering.course_type || !item.course_types.includes(offering.course_type))) return false;
  return true;
}

/**
 * Academic sessions can be initialized before courses are installed.
 * Terms are derived from the published year, but course-specific events
 * must wait until the courses and offerings exist.
 */
export function buildCanonicalMedCalendarSkeleton(input: {
  calendar: CanonicalMedCalendar;
  profiles: readonly MedCourseProfile[];
}) {
  const { calendar, profiles } = input;
  if (calendar.ano_base < 2026 || calendar.estado !== "PUBLICADO") {
    invalid("OFFICIAL_CALENDAR_NOT_PUBLISHED", "O calendário académico oficial ainda não foi publicado.");
  }
  const published = profiles.filter((profile) =>
    profile.ano_base === calendar.ano_base &&
    profile.calendario_canonico_ano === calendar.ano_base &&
    profile.data_inicio === calendar.data_inicio &&
    profile.data_fim === calendar.data_fim &&
    profile.versao_documento === calendar.versao_documento &&
    profile.is_oficial === true && profile.estado === "PUBLICADO"
  ).sort((a, b) => a.id.localeCompare(b.id));
  if (published.length === 0) {
    invalid("OFFICIAL_TRIMESTERS_INCOMPLETE", "Não existem perfis oficiais publicados para o calendário deste ano.");
  }
  const terms = termKey(published[0].items);
  if (published.some((profile) => termKey(profile.items) !== terms)) {
    invalid("ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE", "Os perfis não concordam nos trimestres oficiais.");
  }
  const source = published[0];
  return {
    calendar,
    periods: source.items.filter((item) => item.tipo === "PERIODO_LETIVO")
      .sort((a, b) => Number(a.numero) - Number(b.numero))
      .map((item) => ({
        numero: Number(item.numero), tipo: "TRIMESTRE" as const,
        data_inicio: item.data_inicio, data_fim: item.data_fim,
        peso: item.peso, source_template_id: source.id,
        source_item_id: item.id, source_version: calendar.versao_documento,
      })),
    events: [] as Array<{
      offering_id: string | null; tipo: string; nome: string;
      data_inicio: string; data_fim: string;
      source_template_id: string; source_item_id: string; source_version: string;
    }>,
    selections: [] as CourseCalendarSelection[],
    courseCount: 0,
  };
}

/**
 * Derive the target-year MED profile from the permanent subsystem of each
 * installed course. The compatibility pointer on the offering may still refer
 * to the ACTIVE year, so it must never be used for a FUTURE-year selection.
 */
export function deriveCanonicalMedCourseSelections(input: {
  calendar: CanonicalMedCalendar;
  profiles: readonly MedCourseProfile[];
  offerings: readonly MedCourseOffering[];
}): CourseCalendarSelection[] {
  const { calendar, profiles, offerings } = input;
  const matches = (subsystem: string) => profiles.filter((profile) =>
    profile.ano_base === calendar.ano_base &&
    profile.calendario_canonico_ano === calendar.ano_base &&
    profile.data_inicio === calendar.data_inicio &&
    profile.data_fim === calendar.data_fim &&
    profile.versao_documento === calendar.versao_documento &&
    profile.subsistema === subsystem &&
    profile.is_oficial === true && profile.estado === "PUBLICADO"
  );
  return offerings.map((offering) => {
    const eligible = matches(offering.education_subsystem);
    if (eligible.length !== 1) {
      invalid(
        "OFFICIAL_CALENDAR_PROFILE_NOT_UNIQUE",
        eligible.length === 0
          ? "O calendário MED deste ano não tem perfil para um dos cursos instalados."
          : "Existem vários perfis MED do mesmo subsistema. Reveja a publicação oficial.",
      );
    }
    return { offering_id: offering.id, template_id: eligible[0].id };
  });
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

  // The same fixed source is used before and after curricular installation,
  // preserving the period UUIDs and their published MED provenance.
  const periods = buildCanonicalMedCalendarSkeleton({ calendar, profiles }).periods;

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
      globallyApplicable: item.applies_to_all_offerings !== false &&
        !item.education_subsystems?.length && !item.education_levels?.length &&
        !item.cycles?.length && !item.grade_codes?.length &&
        !item.course_types?.length,
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
