/**
 * Auditoria puramente de leitura do calendário operacional contra os modelos
 * oficiais publicados do MED para o mesmo ano e ofertas educativas da escola.
 * Nunca cria, muda ou encerra períodos, provas, matrículas ou sessões.
 */
export type DecreeSyncIssueCode =
  | "YEAR_MISSING" | "OFFERINGS_MISSING" | "OFFICIAL_PROFILE_MISSING"
  | "OFFICIAL_PROFILE_INCOMPATIBLE" | "PROFILE_YEAR_RANGE_CONFLICT"
  | "YEAR_RANGE_MISMATCH" | "TRIMESTER_MISSING" | "TRIMESTER_DATES_MISMATCH"
  | "TRIMESTER_PROFILE_CONFLICT" | "TRIMESTER_SOURCE_MISMATCH" | "EXAM_EVENT_MISSING"
  | "OFFICIAL_EVENT_MISSING" | "OFFICIAL_EVENT_DATES_MISMATCH"
  | "OFFICIAL_EVENT_PROFILE_CONFLICT" | "OFFICIAL_EVENT_SOURCE_MISSING" | "OFFICIAL_EVENT_SOURCE_MISMATCH"
  | "TRIMESTER_SOURCE_MISSING" | "DOCUMENT_REFERENCE_MISSING";

export type DecreeSyncIssue = {
  code: DecreeSyncIssueCode;
  severity: "blocker" | "warning";
  count: number;
  message: string;
};

type Year = { id: string; ano: number; data_inicio: string; data_fim: string };
type Offering = { id: string; education_subsystem: string; calendar_profile_id: string | null };
type TemplateItem = {
  id: string; tipo: string; numero?: number | null; nome: string;
  data_inicio: string; data_fim: string; peso?: number | null;
  applies_to_all_offerings?: boolean | null;
};
type OfficialTemplate = {
  id: string; ano_base: number; subsistema: string | null;
  data_inicio: string; data_fim: string; estado: string;
  is_oficial: boolean; versao_documento: string | null;
  fonte_documento_url?: string | null; fonte_referencia?: string | null;
  items: TemplateItem[];
};
type Period = {
  id: string; numero: number; tipo: string; data_inicio: string; data_fim: string;
  offering_id: string | null; source_template_id: string | null;
  source_item_id: string | null; source_version: string | null;
};
type Event = {
  id: string; nome: string; tipo: string; data_inicio: string; data_fim: string;
  offering_id: string | null; source_template_id: string | null;
  source_item_id: string | null; source_version: string | null;
};
export type DecreeSyncSnapshot = {
  year: Year | null;
  offerings: Offering[];
  templates: OfficialTemplate[];
  periods: Period[];
  events: Event[];
};

function eventKey(row: { nome: string; tipo: string; data_inicio: string; offering_id?: string | null }) {
  return [row.nome, row.tipo, row.data_inicio, row.offering_id ?? "*"].join("::");
}

function addIssue(issues: DecreeSyncIssue[], code: DecreeSyncIssueCode, severity: DecreeSyncIssue["severity"], message: string, count = 1) {
  const previous = issues.find((issue) => issue.code === code);
  if (previous) previous.count += count;
  else issues.push({ code, severity, count, message });
}

/**
 * Only source-backed dates are canonical. Academic grade weighting can be
 * configured separately, so weights are not used to infer calendar drift.
 */
export function auditDecreeSync(input: DecreeSyncSnapshot) {
  const issues: DecreeSyncIssue[] = [];
  const year = input.year;
  if (!year) {
    addIssue(issues, "YEAR_MISSING", "blocker", "Ano letivo não encontrado.");
    return { ok: false, verified: false, issues, expected_event_count: 0, actual_event_count: input.events.length, expected_trimesters: 0 };
  }
  if (!input.offerings.length) {
    addIssue(issues, "OFFERINGS_MISSING", "blocker", "A escola não tem ofertas educativas classificadas.");
  }

  const profileById = new Map(input.templates.map((t) => [t.id, t]));
  const expectedProfiles = new Map<string, OfficialTemplate>();
  const periodShapes = new Set<string>();

  for (const offering of input.offerings) {
    const profile = offering.calendar_profile_id ? profileById.get(offering.calendar_profile_id) : null;
    if (!profile) {
      addIssue(issues, "OFFICIAL_PROFILE_MISSING", "blocker", "Falta o modelo oficial de uma oferta educativa.");
      continue;
    }
    if (profile.ano_base !== year.ano || profile.subsistema !== offering.education_subsystem
      || !profile.is_oficial || profile.estado !== "PUBLICADO") {
      addIssue(issues, "OFFICIAL_PROFILE_INCOMPATIBLE", "blocker", "O calendário associado à oferta não corresponde ao ano ou subsistema.");
      continue;
    }
    expectedProfiles.set(profile.id, profile);
    if (!profile.fonte_documento_url || !profile.fonte_referencia) {
      addIssue(issues, "DOCUMENT_REFERENCE_MISSING", "warning", "Falta vincular a referência oficial verificável do decreto.", 1);
    }
    const periods = profile.items.filter((item) => item.tipo === "PERIODO_LETIVO")
      .sort((a, b) => Number(a.numero) - Number(b.numero));
    periodShapes.add(JSON.stringify(periods.map((item) => [item.numero, item.data_inicio, item.data_fim])));
  }
  if (periodShapes.size > 1) {
    addIssue(issues, "TRIMESTER_PROFILE_CONFLICT", "blocker", "Os modelos das ofertas têm trimestres incompatíveis.");
  }

  const profiles = [...expectedProfiles.values()];
  const yearRanges = new Set(profiles.map((p) => `${p.data_inicio}|${p.data_fim}`));
  if (yearRanges.size > 1) {
    addIssue(issues, "PROFILE_YEAR_RANGE_CONFLICT", "blocker", "Os modelos oficiais têm limites do ano incompatíveis.");
  } else if (profiles.length && (year.data_inicio !== profiles[0].data_inicio || year.data_fim !== profiles[0].data_fim)) {
    addIssue(issues, "YEAR_RANGE_MISMATCH", "blocker", "As datas do ano letivo diferem do modelo oficial.");
  }

  const referencePeriods = profiles[0]?.items.filter((i) => i.tipo === "PERIODO_LETIVO") ?? [];
  const periodNumbers = new Set<number>();
  for (const item of referencePeriods) {
    if (item.numero == null || periodNumbers.has(item.numero)) continue;
    periodNumbers.add(item.numero);
    const found = input.periods.filter((p) => p.tipo === "TRIMESTRE" && p.numero === item.numero && p.offering_id === null);
    if (!found.length) {
      addIssue(issues, "TRIMESTER_MISSING", "blocker", "Faltam trimestres herdados do decreto.");
      continue;
    }
    if (!found.some((p) => p.data_inicio === item.data_inicio && p.data_fim === item.data_fim)) {
      addIssue(issues, "TRIMESTER_DATES_MISMATCH", "blocker", "Existem trimestres com datas diferentes do modelo oficial.");
    }
    if (found.some((p) => !p.source_template_id || !p.source_item_id || !p.source_version)) {
      addIssue(issues, "TRIMESTER_SOURCE_MISSING", "warning", "Falta rastreabilidade da origem dos trimestres.");
    }
    for (const period of found.filter((p) => p.source_template_id && p.source_item_id && p.source_version)) {
      const sourceProfile = profileById.get(period.source_template_id!);
      const sourceItem = sourceProfile?.items.find((i) => i.id === period.source_item_id);
      if (!sourceProfile || !expectedProfiles.has(sourceProfile.id)
        || sourceProfile.versao_documento !== period.source_version
        || sourceItem?.tipo !== "PERIODO_LETIVO"
        || sourceItem.numero !== item.numero || sourceItem.data_inicio !== period.data_inicio
        || sourceItem.data_fim !== period.data_fim) {
        addIssue(issues, "TRIMESTER_SOURCE_MISMATCH", "blocker", "A origem registada do trimestre não corresponde ao modelo aplicável.");
      }
    }
  }

  const expectedEvents = new Map<string, TemplateItem>();
  for (const profile of profiles) {
    const correspondingOfferings = input.offerings.filter((o) => o.calendar_profile_id === profile.id);
    for (const item of profile.items.filter((i) => i.tipo !== "PERIODO_LETIVO")) {
      // If a rule is scoped to an offering, it needs its own operational event.
      const scoped = item.applies_to_all_offerings === false
        ? correspondingOfferings.map((o) => o.id)
        : [null];
      for (const offeringId of scoped) {
        const key = eventKey({ ...item, offering_id: offeringId });
        const previous = expectedEvents.get(key);
        if (previous && previous.data_fim !== item.data_fim) {
          addIssue(issues, "OFFICIAL_EVENT_PROFILE_CONFLICT", "blocker", "Modelos diferentes definem datas incompatíveis para o mesmo evento.");
        }
        expectedEvents.set(key, item);
      }
    }
  }
  const currentEvents = new Map<string, Event>();
  for (const event of input.events) currentEvents.set(eventKey(event), event);
  for (const [key, item] of expectedEvents) {
    const event = currentEvents.get(key);
    if (!event) {
      addIssue(issues,
        item.tipo.startsWith("PROVA_") || item.tipo.startsWith("EXAME_") ? "EXAM_EVENT_MISSING" : "OFFICIAL_EVENT_MISSING",
        "blocker", "Faltam eventos académicos herdados do decreto.");
    } else {
      if (event.data_fim !== item.data_fim) {
        addIssue(issues, "OFFICIAL_EVENT_DATES_MISMATCH", "blocker", "Um evento oficial tem datas diferentes do modelo.");
      }
      if (!event.source_template_id || !event.source_item_id || !event.source_version) {
        addIssue(issues, "OFFICIAL_EVENT_SOURCE_MISSING", "warning", "Falta a proveniência de um evento oficial.");
      } else {
        const sourceProfile = profileById.get(event.source_template_id);
        const sourceItem = sourceProfile?.items.find((i) => i.id === event.source_item_id);
        if (!sourceProfile || !expectedProfiles.has(sourceProfile.id)
          || sourceProfile.versao_documento !== event.source_version
          || sourceItem?.tipo !== event.tipo || sourceItem.nome !== event.nome
          || sourceItem.data_inicio !== event.data_inicio || sourceItem.data_fim !== event.data_fim) {
          addIssue(issues, "OFFICIAL_EVENT_SOURCE_MISMATCH", "blocker", "A origem registada de um evento não corresponde ao decreto aplicável.");
        }
      }
    }
  }

  return {
    // 'ok' significa compatibilidade operacional; 'verified' exige também
    // proveniência do modelo, trimestres e referência documental completa.
    ok: !issues.some((issue) => issue.severity === "blocker"),
    verified: issues.length === 0,
    issues,
    expected_event_count: expectedEvents.size,
    actual_event_count: input.events.length,
    expected_trimesters: periodNumbers.size,
    calendar_year: year.ano,
    selected_official_templates: profiles.map(({ id, subsistema, versao_documento }) => ({ id, subsistema, versao_documento })),
  };
}
