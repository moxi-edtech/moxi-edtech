export const FISCAL_TAX_PROFILE_CODES = {
  educationM21: "IVA_EDUCACAO_M21",
  standardVat14: "IVA_NORMAL_14_AO",
  simplifiedM00: "IVA_SIMPLIFICADO_M00",
  exclusionM04: "IVA_EXCLUSAO_M04",
} as const;

export type FiscalTaxProfileCode =
  (typeof FISCAL_TAX_PROFILE_CODES)[keyof typeof FISCAL_TAX_PROFILE_CODES];
