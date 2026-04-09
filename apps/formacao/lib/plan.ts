import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { resolveFormacaoSessionContext } from "@/lib/session-context";

export type FormacaoPlan = "basic" | "pro" | "enterprise";

export type FormacaoFeature =
  | "cohorts"
  | "certificados"
  | "honorarios"
  | "faturacao_b2b"
  | "faturacao_b2c"
  | "api_integracoes";

type FeatureRule = {
  minPlan: FormacaoPlan;
};

const PLAN_ORDER: FormacaoPlan[] = ["basic", "pro", "enterprise"];

const FEATURE_RULES: Record<FormacaoFeature, FeatureRule> = {
  cohorts: { minPlan: "basic" },
  certificados: { minPlan: "pro" },
  honorarios: { minPlan: "pro" },
  faturacao_b2b: { minPlan: "pro" },
  faturacao_b2c: { minPlan: "basic" },
  api_integracoes: { minPlan: "enterprise" },
};

const PLAN_LIMITS: Record<FormacaoPlan, { formandosAtivos: number; cohortsAtivos: number }> = {
  basic: { formandosAtivos: 200, cohortsAtivos: 5 },
  pro: { formandosAtivos: 1000, cohortsAtivos: 30 },
  enterprise: { formandosAtivos: 10000, cohortsAtivos: 200 },
};

export function normalizeFormacaoPlan(value: string | null | undefined): FormacaoPlan {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "enterprise") return "enterprise";
  if (v === "pro") return "pro";
  return "basic";
}

export function isFormacaoFeatureAllowed(plan: string | null | undefined, feature: FormacaoFeature): boolean {
  const normalizedPlan = normalizeFormacaoPlan(plan);
  const rule = FEATURE_RULES[feature];
  return PLAN_ORDER.indexOf(normalizedPlan) >= PLAN_ORDER.indexOf(rule.minPlan);
}

export function getFeatureDeniedMessage(plan: string | null | undefined, feature: FormacaoFeature): string {
  const normalizedPlan = normalizeFormacaoPlan(plan);
  const rule = FEATURE_RULES[feature];
  return `Funcionalidade '${feature}' indisponível no plano ${normalizedPlan}. Necessário plano ${rule.minPlan}.`;
}

export function getFormacaoPlanLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[normalizeFormacaoPlan(plan)];
}

export async function getFormacaoPlanContext() {
  const supabase = await supabaseServer();
  const session = await resolveFormacaoSessionContext();
  const escolaId = String(session?.tenantId ?? "").trim();

  if (!escolaId) {
    return {
      escolaId: null,
      plan: "basic" as FormacaoPlan,
      limits: PLAN_LIMITS.basic,
    };
  }

  const { data } = await (supabase as FormacaoSupabaseClient)
    .from("centros_formacao")
    .select("plano")
    .eq("escola_id", escolaId)
    .limit(1)
    .maybeSingle();

  const plan = normalizeFormacaoPlan((data as { plano?: string } | null)?.plano ?? "basic");

  return {
    escolaId,
    plan,
    limits: PLAN_LIMITS[plan],
  };
}
