import type { SupabaseClient } from "@supabase/supabase-js";

export const REMATRICULA_SOURCE_STATUSES = [
  "ativo",
  "ativa",
  "active",
  "em_andamento",
  "matriculado",
  "transferido",
  "concluido",
  "concluida",
  "aprovado",
  "aprovada",
  "reprovado",
  "reprovada",
] as const;

export type RematriculaSource = {
  id: string;
  aluno_id: string;
  escola_id: string;
  turma_id: string | null;
  ano_letivo: number;
  status: string;
  ativo: boolean | null;
};

export function isRematriculaSourceStatus(status: string | null | undefined): boolean {
  return REMATRICULA_SOURCE_STATUSES.includes(
    String(status ?? "").trim().toLowerCase() as (typeof REMATRICULA_SOURCE_STATUSES)[number],
  );
}

/**
 * Resolves the academic origin for a new-year rematriculation.
 *
 * A historical year may be closed as `concluido` or `reprovado`; requiring an
 * active row in the target year would make the portal depend on a matrícula
 * that should only be created after confirmation.
 */
export async function resolveRematriculaSource(
  supabase: SupabaseClient,
  escolaId: string,
  alunoId: string,
  targetYear: number,
): Promise<{ data: RematriculaSource | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, aluno_id, escola_id, turma_id, ano_letivo, status, ativo")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .lt("ano_letivo", targetYear)
    .in("status", REMATRICULA_SOURCE_STATUSES as unknown as string[])
    .order("ano_letivo", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    data: (data as RematriculaSource | null) ?? null,
    error: error ? new Error(error.message) : null,
  };
}
