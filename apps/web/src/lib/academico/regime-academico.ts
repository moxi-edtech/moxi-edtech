import type { SupabaseClient } from "@supabase/supabase-js";

export type EscalaAcademica =
  | "quantitativa_primario"
  | "quantitativa_secundario"
  | "qualitativa";

export type RegimeAcademico = {
  eh_classe_exame: boolean;
  codigo_regime: string;
  nivel_ensino: string;
  classe_num: number | null;
  ano_numero: number | null;
  modulo_numero: number | null;
  tipo_exame_nacional: string | null;
  escala: EscalaAcademica;
  formula_mfd: Record<string, unknown>;
  exames_aplicaveis: string[];
};

/** Único wrapper TS do resolvedor. Não duplicar regras académicas aqui. */
export async function resolveRegimeAcademico(
  supabase: SupabaseClient,
  turmaId: string,
): Promise<RegimeAcademico> {
  const { data, error } = await (supabase as any).rpc("resolve_regime_academico", {
    p_turma_id: turmaId,
  });

  if (error) throw new Error(`Não foi possível resolver o regime académico: ${error.message}`);
  if (!data) throw new Error("Turma não encontrada para resolver o regime académico.");
  return data as RegimeAcademico;
}
