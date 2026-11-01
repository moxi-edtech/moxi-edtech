/**
 * A first/second trimester is academic progress, never a final progression.
 * Returns false for missing or ambiguous periods; it does not manufacture
 * decisions for schools using a different calendar or offering.
 */
type ActiveTrimester = {
  numero: number;
  offering_id: string | null;
  data_inicio: string;
  data_fim: string;
};

export function isSourceInEarlyTrimester(input: {
  today: string;
  periods: readonly ActiveTrimester[];
  offeringId: string | null;
}): boolean {
  const active = input.periods.filter((period) =>
    period.data_inicio <= input.today && input.today <= period.data_fim);
  const specific = input.offeringId
    ? active.filter((period) => period.offering_id === input.offeringId) : [];
  const applicable = specific.length ? specific : active.filter((period) => period.offering_id == null);
  return applicable.length === 1 && [1, 2].includes(Number(applicable[0].numero));
}

/** Tenant-scoped read. No academic decision or mutation is made here. */
export async function isSourceYearStillInEarlyTrimester(
  supabase: any,
  escolaId: string,
  source: { session_id: string | null; turma_id: string | null },
): Promise<boolean> {
  if (!source.session_id || !source.turma_id) return false;
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" });
    const { data: periods, error } = await supabase.from("periodos_letivos")
      .select("numero,offering_id,data_inicio,data_fim")
      .eq("escola_id", escolaId).eq("ano_letivo_id", source.session_id)
      .eq("tipo", "TRIMESTRE")
      .lte("data_inicio", today).gte("data_fim", today).limit(10);
    if (error || !periods?.length) return false;
    let offeringId: string | null = null;
    if (periods.some((period: ActiveTrimester) => period.offering_id)) {
      const { data: turma } = await supabase.from("turmas")
        .select("curso_id").eq("escola_id", escolaId).eq("id", source.turma_id).maybeSingle();
      if (turma?.curso_id) {
        const { data: offerings } = await supabase.from("school_education_offerings")
          .select("id").eq("escola_id", escolaId).eq("course_id", turma.curso_id).limit(2);
        offeringId = offerings?.length === 1 ? offerings[0].id : null;
      }
    }
    return isSourceInEarlyTrimester({ today, periods, offeringId });
  } catch {
    // The RAA remains authoritative when calendar lookup is unavailable.
    return false;
  }
}
