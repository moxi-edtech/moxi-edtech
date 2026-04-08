import {
  PLAN_FEATURES,
  PLAN_NAMES,
  parsePlanTier,
  type FeatureKey,
  type PlanTier,
} from "@/config/plans";
import type { ProductContext } from "@/lib/permissions";

type TenantType = "k12" | "formacao";

export type FeatureGateConfig = {
  feature: FeatureKey;
  minPlan: PlanTier;
  products: ProductContext[];
  tenantTypes: TenantType[];
  errorCode: "PLAN_FEATURE_REQUIRED";
  upgradeCta: string;
};

export const FEATURE_GATE_MATRIX: Record<FeatureKey, FeatureGateConfig> = {
  fin_recibo_pdf: {
    feature: "fin_recibo_pdf",
    minPlan: "essencial",
    products: ["k12", "formacao"],
    tenantTypes: ["k12", "formacao"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_fin_recibo_pdf",
  },
  sec_upload_docs: {
    feature: "sec_upload_docs",
    minPlan: "profissional",
    products: ["k12"],
    tenantTypes: ["k12"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_sec_upload_docs",
  },
  sec_matricula_online: {
    feature: "sec_matricula_online",
    minPlan: "premium",
    products: ["k12"],
    tenantTypes: ["k12"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_sec_matricula_online",
  },
  doc_qr_code: {
    feature: "doc_qr_code",
    minPlan: "premium",
    products: ["k12", "formacao"],
    tenantTypes: ["k12", "formacao"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_doc_qr_code",
  },
  relatorio_avancado: {
    feature: "relatorio_avancado",
    minPlan: "premium",
    products: ["k12", "formacao"],
    tenantTypes: ["k12", "formacao"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_relatorio_avancado",
  },
  app_whatsapp_auto: {
    feature: "app_whatsapp_auto",
    minPlan: "premium",
    products: ["k12"],
    tenantTypes: ["k12"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_app_whatsapp_auto",
  },
  suporte_prioritario: {
    feature: "suporte_prioritario",
    minPlan: "premium",
    products: ["k12", "formacao"],
    tenantTypes: ["k12", "formacao"],
    errorCode: "PLAN_FEATURE_REQUIRED",
    upgradeCta: "upgrade_suporte_prioritario",
  },
};

export function isFeatureAllowed(
  plan: string | null | undefined,
  feature: FeatureKey,
  options?: { productContext?: ProductContext; tenantType?: TenantType }
): boolean {
  const productContext = options?.productContext ?? "k12";
  const tenantType = options?.tenantType ?? "k12";
  const matrix = FEATURE_GATE_MATRIX[feature];
  if (!matrix.products.includes(productContext)) return false;
  if (!matrix.tenantTypes.includes(tenantType)) return false;

  const tier = parsePlanTier(plan);
  return Boolean(PLAN_FEATURES[tier]?.[feature]);
}

export function getFeatureDeniedMessage(plan: string | null | undefined, feature: FeatureKey): string {
  const tier = parsePlanTier(plan);
  const planName = PLAN_NAMES[tier];
  const neededPlan = PLAN_NAMES[FEATURE_GATE_MATRIX[feature].minPlan];
  return `Funcionalidade '${feature}' indisponível no plano ${planName}. Faça upgrade para ${neededPlan}.`;
}
