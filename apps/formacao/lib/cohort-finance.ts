import type { FormacaoSupabaseClient } from "@/lib/db-types";

export async function getCohortReferenceValue(
  client: FormacaoSupabaseClient,
  escolaId: string,
  cohortId: string | null | undefined
) {
  const id = String(cohortId ?? "").trim();
  if (!id) return null;

  const { data, error } = await client
    .from("formacao_cohort_financeiro")
    .select("valor_referencia")
    .eq("escola_id", escolaId)
    .eq("cohort_id", id)
    .maybeSingle();

  if (error) return null;

  const value = Number((data as { valor_referencia?: number | null } | null)?.valor_referencia ?? null);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export async function upsertCohortReferenceValue(
  client: FormacaoSupabaseClient,
  params: {
    escolaId: string;
    cohortId: string;
    userId: string;
    valorReferencia: number;
    moeda?: string;
  }
) {
  const payload = {
    escola_id: params.escolaId,
    cohort_id: params.cohortId,
    created_by: params.userId,
    moeda: params.moeda ?? "AOA",
    valor_referencia: params.valorReferencia,
    updated_at: new Date().toISOString(),
  };

  return client
    .from("formacao_cohort_financeiro")
    .upsert(payload, { onConflict: "escola_id,cohort_id" });
}
