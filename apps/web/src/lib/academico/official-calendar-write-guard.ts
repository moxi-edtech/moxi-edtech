export type OfficialCalendarPeriod = {
  id: string;
  numero: number;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  peso: number | null;
  trava_notas_em: string | null;
  source_template_id: string | null;
  source_item_id: string | null;
  source_version: string | null;
  offering_id?: string | null;
};

export type OfficialTemplatePeriod = {
  id: string;
  numero: number | null;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  peso: number | null;
};

export type OfficialCalendarTemplate = {
  id: string;
  ano_base: number;
  is_oficial: boolean;
  estado: string;
  data_inicio: string;
  data_fim: string;
  versao_documento: string | null;
  items: OfficialTemplatePeriod[];
};

export type RequestedPeriodAdjustment = {
  id?: string;
  ano_letivo_id: string;
  tipo: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  peso?: number | null;
  trava_notas_em?: string | null;
};

export type CalendarAdjustmentResult =
  | { ok: true; periods: Array<RequestedPeriodAdjustment & {
      id: string;
      peso: number | null;
      trava_notas_em: string | null;
      source_template_id: string;
      source_item_id: string;
      source_version: string | null;
    }>; lockChanged: boolean }
  | { ok: false; code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION" | "CALENDAR_LOCK_CHANGE_REASON_REQUIRED" };

export function validateOfficialCalendarAdjustment(input: {
  academicYear: number;
  academicYearId: string;
  requestedYearStart: string;
  requestedYearEnd: string;
  currentYearStart: string;
  currentYearEnd: string;
  existing: OfficialCalendarPeriod[];
  requested: RequestedPeriodAdjustment[];
  template: OfficialCalendarTemplate | null;
  motivo?: string;
}): CalendarAdjustmentResult {
  const reject = (code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION" | "CALENDAR_LOCK_CHANGE_REASON_REQUIRED"):
    CalendarAdjustmentResult => ({ ok: false, code });
  const { template, existing, requested } = input;
  if (!template || template.ano_base !== input.academicYear ||
    !template.is_oficial || template.estado !== "PUBLICADO" ||
    !template.versao_documento ||
    template.data_inicio !== input.currentYearStart ||
    template.data_fim !== input.currentYearEnd ||
    input.requestedYearStart !== template.data_inicio ||
    input.requestedYearEnd !== template.data_fim ||
    existing.length !== 3 || requested.length !== 3) {
    return reject("OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION");
  }

  const officialItems = template.items.filter((item) => item.tipo === "PERIODO_LETIVO");
  const numbers = [1, 2, 3];
  if (officialItems.length !== 3 || new Set(officialItems.map((item) => item.numero)).size !== 3 ||
    existing.some((item) => !numbers.includes(item.numero)) ||
    requested.some((item) => !numbers.includes(item.numero)) ||
    new Set(existing.map((item) => item.numero)).size !== 3 ||
    new Set(requested.map((item) => item.numero)).size !== 3) {
    return reject("OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION");
  }

  const stored = new Map(existing.map((item) => [item.numero, item] as const));
  const canonical = new Map(officialItems.map((item) => [item.numero, item] as const));
  const periods: Extract<CalendarAdjustmentResult, { ok: true }>["periods"] = [];
  let lockChanged = false;

  for (const proposal of requested) {
    const current = stored.get(proposal.numero);
    const item = canonical.get(proposal.numero);
    if (!current || !item || current.offering_id != null ||
      current.tipo !== "TRIMESTRE" || proposal.tipo !== "TRIMESTRE" ||
      proposal.ano_letivo_id !== input.academicYearId ||
      (proposal.id !== undefined && proposal.id !== current.id) ||
      current.source_template_id !== template.id ||
      current.source_item_id !== item.id ||
      current.data_inicio !== item.data_inicio ||
      current.data_fim !== item.data_fim ||
      proposal.data_inicio !== item.data_inicio ||
      proposal.data_fim !== item.data_fim ||
      current.peso !== item.peso ||
      (proposal.peso !== undefined && proposal.peso !== item.peso)) {
      return reject("OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION");
    }
    const targetLock = proposal.trava_notas_em === undefined
      ? current.trava_notas_em : proposal.trava_notas_em;
    if (targetLock !== current.trava_notas_em) lockChanged = true;
    periods.push({
      id: current.id, ano_letivo_id: input.academicYearId, tipo: "TRIMESTRE",
      numero: item.numero!, data_inicio: item.data_inicio, data_fim: item.data_fim,
      peso: item.peso, trava_notas_em: targetLock,
      source_template_id: template.id,
      source_item_id: item.id,
      source_version: template.versao_documento,
    });
  }

  if (lockChanged && !input.motivo?.trim()) {
    return reject("CALENDAR_LOCK_CHANGE_REASON_REQUIRED");
  }
  return { ok: true, periods, lockChanged };
}
