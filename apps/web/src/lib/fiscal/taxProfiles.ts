export const FISCAL_TAX_PROFILE_CODES = {
  educationM21: "IVA_EDUCACAO_M21",
  standardVat14: "IVA_NORMAL_14_AO",
} as const;

export type FiscalTaxProfileCode =
  (typeof FISCAL_TAX_PROFILE_CODES)[keyof typeof FISCAL_TAX_PROFILE_CODES];
