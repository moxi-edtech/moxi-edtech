export const PLAN_VALUES = ["essencial", "profissional", "premium"] as const;
export type PlanTier = (typeof PLAN_VALUES)[number];

const PLAN_SET = new Set<string>(PLAN_VALUES);

export function parsePlanTier(v: unknown): PlanTier {
  if (typeof v !== "string") return "essencial";
  const p = v.trim().toLowerCase();
  return PLAN_SET.has(p) ? (p as PlanTier) : "essencial";
}

export type FeatureKey =
  | "fin_recibo_pdf"
  | "sec_upload_docs"
  | "sec_matricula_online"
  | "doc_qr_code"
  | "app_whatsapp_auto"
  | "suporte_prioritario";

export const PLAN_NAMES: Record<PlanTier, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Premium",
};

export const PLAN_FEATURES: Record<PlanTier, Record<FeatureKey, boolean>> = {
  essencial: {
    fin_recibo_pdf: true,
    sec_upload_docs: false,
    sec_matricula_online: false,
    doc_qr_code: false,
    app_whatsapp_auto: false,
    suporte_prioritario: false,
  },
  profissional: {
    fin_recibo_pdf: true,
    sec_upload_docs: true,
    sec_matricula_online: false,
    doc_qr_code: false,
    app_whatsapp_auto: false,
    suporte_prioritario: false,
  },
  premium: {
    fin_recibo_pdf: true,
    sec_upload_docs: true,
    sec_matricula_online: true,
    doc_qr_code: true,
    app_whatsapp_auto: true,
    suporte_prioritario: true,
  },
};

