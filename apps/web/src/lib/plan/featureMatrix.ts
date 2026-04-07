import {
  PLAN_FEATURES,
  PLAN_NAMES,
  parsePlanTier,
  type FeatureKey,
  type PlanTier,
} from "@/config/plans";

export type FeatureGateConfig = {
  feature: FeatureKey;
  minPlan: PlanTier;
  errorCode: "PLAN_FEATURE_REQUIRED";
  upgradeCta: string;
};

export const FEATURE_GATE_MATRIX: Record<FeatureKey, FeatureGateConfig> = {
  fin_recibo_pdf: {
    feature: "fin_recibo_pdf",
    minPlan: "essencial",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_fin_recibo_pdf",
  },
  sec_upload_docs: {
    feature: "sec_upload_docs",
    minPlan: "profissional",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_sec_upload_docs",
  },
  sec_matricula_online: {
    feature: "sec_matricula_online",
    minPlan: "premium",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_sec_matricula_online",
  },
  doc_qr_code: {
    feature: "doc_qr_code",
    minPlan: "premium",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_doc_qr_code",
  },
  relatorio_avancado: {
    feature: "relatorio_avancado",
    minPlan: "premium",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_relatorio_avancado",
  },
  app_whatsapp_auto: {
    feature: "app_whatsapp_auto",
    minPlan: "premium",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_app_whatsapp_auto",
  },
  suporte_prioritario: {
    feature: "suporte_prioritario",
    minPlan: "premium",
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_suporte_prioritario",
  },
};

export function isFeatureAllowed(plan: string | null | undefined, feature: FeatureKey): boolean {
  const tier = parsePlanTier(plan);
  return Boolean(PLAN_FEATURES[tier]?.[feature]);
}

export function getFeatureDeniedMessage(plan: string | null | undefined, feature: FeatureKey): string {
  const tier = parsePlanTier(plan);
  const planName = PLAN_NAMES[tier];
  const neededPlan = PLAN_NAMES[FEATURE_GATE_MATRIX[feature].minPlan];
  return `Funcionalidade '${feature}' indisponível no plano ${planName}. Faça upgrade para ${neededPlan}.`;
}
