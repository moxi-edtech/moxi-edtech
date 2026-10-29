import {
  CanonicalPeriodReadError,
  verifyCanonicalPeriodsRead,
  type MedPeriod,
} from "./verify-canonical-periods-read";

/**
 * Shared read contract for consumers that derive results or initiate work
 * from a trimester. Caller must first authorize the user, school and year.
 * The database query is scoped BEFORE the result reaches the application.
 */
export type VerifiedAcademicTrimester = MedPeriod & {
  id: string;
  trava_notas_em: string | null;
};

export async function readVerifiedAcademicTrimesters(
  db: any,
  input: { escolaId: string; anoLetivoId: string; yearBase: number },
): Promise<VerifiedAcademicTrimester[]> {
  if (!input.escolaId || !input.anoLetivoId || !Number.isInteger(input.yearBase)) {
    throw new CanonicalPeriodReadError("Contexto do ano letivo inválido.");
  }
  const { data, error } = await db.from("periodos_letivos")
    .select("id,numero,tipo,data_inicio,data_fim,peso,trava_notas_em,offering_id,source_template_id,source_item_id,source_version")
    .eq("escola_id", input.escolaId)
    .eq("ano_letivo_id", input.anoLetivoId)
    .eq("tipo", "TRIMESTRE")
    .order("numero", { ascending: true })
    .limit(12);
  if (error) throw error;
  const rows = (data ?? []) as VerifiedAcademicTrimester[];
  await verifyCanonicalPeriodsRead(db, { ...input, periods: rows });
  return rows;
}

/** A period identifier is only valid inside the already-verified school/year. */
export function requireVerifiedTrimester(
  periods: readonly VerifiedAcademicTrimester[],
  selector: { id?: string | null; numero?: number | null },
): VerifiedAcademicTrimester {
  const row = selector.id
    ? periods.find((period) => period.id === selector.id)
    : periods.find((period) => period.numero === selector.numero);
  if (!row) {
    throw new CanonicalPeriodReadError("O trimestre não pertence ao calendário selecionado.");
  }
  return row;
}

export function verifiedTrimesterForDate(
  periods: readonly VerifiedAcademicTrimester[],
  date: string,
): VerifiedAcademicTrimester {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) {
    throw new CanonicalPeriodReadError("A data da aula é inválida.");
  }
  const matches = periods.filter((row) =>
    Boolean(row.data_inicio && row.data_fim &&
      date >= row.data_inicio! && date <= row.data_fim!));
  if (matches.length !== 1) {
    throw new CanonicalPeriodReadError("A data está fora dos trimestres do calendário académico.");
  }
  return matches[0];
}
