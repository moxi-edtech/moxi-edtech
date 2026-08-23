import type { SupabaseClient } from "@supabase/supabase-js";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export type AnoLetivoScope = {
  id: string;
  ano: number;
  dataInicio: string | null;
  dataFim: string | null;
};

type ResolveParams = {
  anoLetivoId?: string | null;
  ano?: number | null;
};

function normalizeYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) return Number(value);
  return null;
}

export async function resolveAnoLetivoScope(
  supabase: SupabaseClient,
  escolaId: string,
  params: ResolveParams = {}
): Promise<AnoLetivoScope | null> {
  const requestedAno = normalizeYear(params.ano);
  try {
    const scope = await resolveAcademicYearScope(supabase, {
      escolaId,
      requestedAcademicYearId: params.anoLetivoId,
      requestedYear: requestedAno,
    });
    return {
      id: scope.id,
      ano: scope.ano,
      dataInicio: scope.dataInicio,
      dataFim: scope.dataFim,
    };
  } catch (error) {
    if (error instanceof AcademicYearContextError && ["ACADEMIC_YEAR_NOT_FOUND", "ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED"].includes(error.code)) {
      return null;
    }
    throw error;
  }
}
