import { parsePlanTier, type PlanTier } from "@/config/plans";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type PlanLimitsRow = Database["public"]["Tables"]["app_plan_limits"]["Row"];

export type AlunoLimitCheck = {
  ok: boolean;
  plan: PlanTier | null;
  max: number | null;
  current: number;
  incoming: number;
};

export async function checkAlunoPlanLimit(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  incoming: number
): Promise<AlunoLimitCheck> {
  const { data: escolaRow } = await supabase
    .from("escolas")
    .select("plano_atual")
    .eq("id", escolaId)
    .maybeSingle();

  const plan = escolaRow?.plano_atual ? parsePlanTier(escolaRow.plano_atual) : null;

  const { data: limitsRow } = plan
    ? await supabase
        .from("app_plan_limits")
        .select("plan, max_alunos")
        .eq("plan", plan)
        .maybeSingle()
    : { data: null as PlanLimitsRow | null };

  const max = limitsRow?.max_alunos ?? null;

  const { count } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .is("deleted_at", null);

  const current = count ?? 0;
  const nextTotal = current + incoming;

  if (max !== null && nextTotal > max) {
    return { ok: false, plan, max, current, incoming };
  }

  return { ok: true, plan, max, current, incoming };
}
