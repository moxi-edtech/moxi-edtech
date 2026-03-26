import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePlanTier, type PlanTier } from "@/config/plans";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

type FiscalPlanGuardResult =
  | { ok: true; escolaId: string | null; plan: PlanTier | null }
  | { ok: false; status: number; code: string; message: string; escolaId: string | null; plan: PlanTier | null };

async function isSuperAdmin(supabase: SupabaseClient<Database>) {
  try {
    const { data, error } = await supabase.rpc("check_super_admin_role");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function requireFiscalPremiumPlan({
  supabase,
  userId,
  escolaId,
  empresaId,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  escolaId: string | null;
  empresaId?: string | null;
}): Promise<FiscalPlanGuardResult> {
  if (await isSuperAdmin(supabase)) {
    return { ok: true, escolaId: escolaId ?? null, plan: "premium" };
  }

  let resolvedEscolaId = escolaId;
  if (!resolvedEscolaId) {
    resolvedEscolaId = await resolveEscolaIdForUser(supabase, userId);
  }

  if (!resolvedEscolaId && empresaId) {
    const { data: binding } = await supabase
      .from("fiscal_escola_bindings")
      .select("escola_id, is_primary, effective_from")
      .eq("empresa_id", empresaId)
      .is("effective_to", null)
      .order("is_primary", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedEscolaId = binding?.escola_id ?? null;
  }

  if (!resolvedEscolaId) {
    return {
      ok: false,
      status: 403,
      code: "NO_SCHOOL",
      message: "Usuário sem escola associada para validar plano fiscal.",
      escolaId: null,
      plan: null,
    };
  }

  const { data: escola, error } = await supabase
    .from("escolas")
    .select("plano_atual")
    .eq("id", resolvedEscolaId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      code: "PLAN_CHECK_FAILED",
      message: error.message || "Falha ao validar plano da escola.",
      escolaId: resolvedEscolaId,
      plan: null,
    };
  }

  const plan = parsePlanTier(escola?.plano_atual ?? null);
  if (plan !== "premium") {
    return {
      ok: false,
      status: 403,
      code: "PLAN_UPGRADE_REQUIRED",
      message: "Seu plano atual não inclui o módulo fiscal. Faça upgrade para Premium.",
      escolaId: resolvedEscolaId,
      plan,
    };
  }

  return {
    ok: true,
    escolaId: resolvedEscolaId,
    plan,
  };
}
