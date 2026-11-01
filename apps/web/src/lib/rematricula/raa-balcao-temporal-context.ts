/**
 * A trimester is authoritative only when the attendance record's period
 * belongs to the original academic year and is explicitly TRIMESTRE.
 * Missing/ambiguous associations are kept unassigned, not inferred by date.
 */
export type RaaTrimestre = 1 | 2 | 3;
export type RaaCasePeriod = RaaTrimestre | "ano_letivo" | "nao_identificado";

export function isRaaTrimestre(value: unknown): value is RaaTrimestre {
  return value === 1 || value === 2 || value === 3;
}

export function resolveRaaTrimestre(
  frequency: { periodo_letivo_id: string | null } | null | undefined,
  periodById: ReadonlyMap<string, {
    numero: number | string;
    tipo: string | null;
    ano_letivo_id: string | null;
  }>,
  sourceAcademicYearId: string | null,
): RaaTrimestre | null {
  if (!sourceAcademicYearId || !frequency?.periodo_letivo_id) return null;
  const officialPeriod = periodById.get(frequency.periodo_letivo_id);
  if (!officialPeriod || officialPeriod.ano_letivo_id !== sourceAcademicYearId ||
      officialPeriod.tipo?.toUpperCase() !== "TRIMESTRE") return null;
  const numero = Number(officialPeriod.numero);
  return isRaaTrimestre(numero) ? numero : null;
}

export function raaCasePeriodLabel(period: RaaCasePeriod): string {
  if (period === "ano_letivo") return "Contexto anual";
  if (period === "nao_identificado") return "Trimestre por confirmar";
  return period + ".º trimestre";
}

export function matchesRaaPeriodFilter(
  period: RaaCasePeriod,
  filter: "todos" | "1" | "2" | "3" | "outros",
): boolean {
  if (filter === "todos") return true;
  if (filter === "outros") return period === "ano_letivo" || period === "nao_identificado";
  return period === Number(filter);
}
