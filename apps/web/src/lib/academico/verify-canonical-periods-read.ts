/**
 * Validate read-only MED trimester provenance for a school/year already
 * authorized by the calling API. PostgreSQL remains the write authority.
 */
export type MedPeriod = {
  numero: number | null;
  tipo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  peso: number | null;
  offering_id: string | null;
  source_template_id: string | null;
  source_item_id: string | null;
  source_version: string | null;
};

export class CanonicalPeriodReadError extends Error {
  readonly code = "OFFICIAL_CALENDAR_NOT_RECONCILED";
  readonly status = 409;
  constructor(message = "Os trimestres precisam de ser sincronizados com o calendário oficial MED.") {
    super(message);
    this.name = "CanonicalPeriodReadError";
  }
}

export async function verifyCanonicalPeriodsRead(
  db: any,
  input: {
    escolaId: string;
    anoLetivoId: string;
    yearBase: number;
    periods: readonly MedPeriod[];
  },
): Promise<void> {
  if (!Number.isInteger(input.yearBase) || input.yearBase < 1900 ||
      !input.escolaId || !input.anoLetivoId) {
    throw new CanonicalPeriodReadError("O contexto do ano letivo é inválido.");
  }
  // Historical years preserve the existing legacy read semantics.
  if (input.yearBase < 2026) return;

  const periods = [...input.periods].sort((a, b) => Number(a.numero) - Number(b.numero));
  if (periods.length !== 3 ||
      periods.some((row, index) =>
        row.numero !== index + 1 || row.tipo !== "TRIMESTRE" ||
        row.offering_id !== null ||
        !row.source_template_id || !row.source_item_id || !row.source_version ||
        !row.data_inicio || !row.data_fim || row.data_inicio > row.data_fim ||
        (index > 0 && row.data_inicio <= periods[index - 1].data_fim!))) {
    throw new CanonicalPeriodReadError();
  }

  const templateId = periods[0].source_template_id;
  const version = periods[0].source_version;
  if (periods.some((row) =>
    row.source_template_id !== templateId || row.source_version !== version) ||
    new Set(periods.map((row) => row.source_item_id)).size !== 3) {
    throw new CanonicalPeriodReadError();
  }

  const [calendarResult, profileResult] = await Promise.all([
    db.from("calendarios_oficiais_anos")
      .select("ano_base,data_inicio,data_fim,versao_documento,estado")
      .eq("ano_base", input.yearBase).eq("estado", "PUBLICADO").maybeSingle(),
    db.from("calendario_templates")
      .select("id,ano_base,calendario_canonico_ano,data_inicio,data_fim,versao_documento,is_oficial,estado,items:calendario_template_items(id,tipo,numero,data_inicio,data_fim,peso)")
      .eq("id", templateId).eq("is_oficial", true).eq("estado", "PUBLICADO")
      .maybeSingle(),
  ]);
  if (calendarResult.error || profileResult.error) {
    throw new CanonicalPeriodReadError("Não foi possível validar a origem dos trimestres MED.");
  }
  const calendar = calendarResult.data;
  const profile = profileResult.data;
  if (!calendar || !profile || calendar.ano_base !== input.yearBase ||
      profile.ano_base !== input.yearBase ||
      profile.calendario_canonico_ano !== input.yearBase ||
      profile.data_inicio !== calendar.data_inicio ||
      profile.data_fim !== calendar.data_fim ||
      version !== calendar.versao_documento ||
      profile.versao_documento !== version) {
    throw new CanonicalPeriodReadError();
  }
  const sourceItems = new Map<string, {
    id: string; tipo: string; numero: number; data_inicio: string;
    data_fim: string; peso: number | null;
  }>((profile.items ?? []).map((item: {
    id: string; tipo: string; numero: number; data_inicio: string;
    data_fim: string; peso: number | null;
  }) => [item.id, item] as const));
  for (const row of periods) {
    const source = sourceItems.get(row.source_item_id!);
    if (!source || source.tipo !== "PERIODO_LETIVO" ||
        source.numero !== row.numero || source.data_inicio !== row.data_inicio ||
        source.data_fim !== row.data_fim || source.peso !== row.peso) {
      throw new CanonicalPeriodReadError();
    }
  }
}
