import { z } from "zod";

export const FISCAL_ORIGENS_DOCUMENTO = [
  "interno",
  "manual_recuperado",
  "integrado",
  "formacao",
  "contingencia",
] as const;

export const FISCAL_TIPOS_DOCUMENTO = ["FR", "FT", "NC", "ND", "RC", "PP", "GR", "GT", "FG"] as const;
export const FISCAL_PAYMENT_MECHANISM_CODES = ["NU", "TB", "CC", "MB"] as const;
export const FISCAL_OPERATION_TYPES = ["SE", "SS", "STP", "SR", "SIF", "SHS", "ST", "SG", "TB", "AS", "QT", "RD"] as const;
export const FISCAL_IVA_TAX_CODES = ["NOR", "INT", "RED", "ISE", "OUT"] as const;
export const FISCAL_PRODUCT_TYPES = ["P", "S", "O", "E", "I"] as const;

export const fiscalDocumentoItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  product_code: z.string().trim().min(1).max(64),
  product_number_code: z.string().trim().min(1).max(64).optional(),
  tax_profile_code: z.string().trim().min(3).max(64),
  product_type: z.enum(FISCAL_PRODUCT_TYPES).default("S"),
  operation_type: z.enum(FISCAL_OPERATION_TYPES).default("SE"),
  unit_of_measure: z.string().trim().min(1).max(20).default("UN"),
  tax_code: z.enum(FISCAL_IVA_TAX_CODES).optional(),
  tax_country_region: z.string().trim().min(2).max(6).default("AO"),
  quantidade: z.coerce.number().positive(),
  unit_price_base: z.coerce.number().min(0).optional(),
  preco_unit: z.coerce.number().min(0),
  settlement_amount: z.coerce.number().min(0).default(0),
  taxa_iva: z.coerce.number().min(0).max(100),
  tax_exemption_code: z.string().trim().regex(/^M\d{2}$/).optional(),
  tax_exemption_reason: z.string().trim().min(6).max(60).optional(),
});

export const fiscalDocumentoUiItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valor: z.coerce.number().positive(),
});

export const fiscalDocumentoClienteSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(255),
  nif: z
    .string()
    .trim()
    .regex(/^\d{9,20}$/)
    .optional(),
  address_detail: z.string().trim().min(1).max(255).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  postal_code: z.string().trim().min(1).max(40).optional(),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("AO"),
});

export const postFiscalDocumentoSchema = z
  .object({
    empresa_id: z.string().uuid(),
    tipo_documento: z.enum(FISCAL_TIPOS_DOCUMENTO),
    prefixo_serie: z.string().trim().min(1).max(50),
    origem_documento: z.enum(FISCAL_ORIGENS_DOCUMENTO).default("interno"),
    cliente: fiscalDocumentoClienteSchema,
    documento_origem_id: z.string().uuid().nullable().optional(),
    rectifica_documento_id: z.string().uuid().nullable().optional(),
    invoice_date: z.string().date(),
    moeda: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    taxa_cambio_aoa: z.coerce.number().positive().nullable().optional(),
    payment_mechanism: z.enum(FISCAL_PAYMENT_MECHANISM_CODES).optional(),
    itens: z.array(fiscalDocumentoItemSchema).min(1).max(500),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    const moeda = data.moeda.toUpperCase();

    if (moeda !== "AOA" && !data.taxa_cambio_aoa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxa_cambio_aoa"],
        message: "taxa_cambio_aoa é obrigatória quando moeda != 'AOA'",
      });
    }

    if (moeda === "AOA" && data.taxa_cambio_aoa != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxa_cambio_aoa"],
        message: "taxa_cambio_aoa deve ser nula quando moeda = 'AOA'",
      });
    }

    if (data.tipo_documento === "NC" && !data.rectifica_documento_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rectifica_documento_id"],
        message: "rectifica_documento_id é obrigatório para nota de crédito",
      });
    }

    if (data.tipo_documento === "RC" && !data.payment_mechanism) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment_mechanism"],
        message: "payment_mechanism é obrigatório para recibos (RC).",
      });
    }

    data.itens.forEach((item, index) => {
      if (item.unit_price_base != null && item.unit_price_base + 0.0001 < item.preco_unit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itens", index, "unit_price_base"],
          message: "unit_price_base não pode ser inferior a preco_unit.",
        });
      }

      if (item.taxa_iva === 0 && (!item.tax_exemption_code || !item.tax_exemption_reason)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itens", index],
          message:
            "Quando taxa_iva = 0, tax_exemption_code e tax_exemption_reason são obrigatórios.",
        });
      }
    });
  });

export const postFiscalDocumentoUiSchema = z
  .object({
    ano_fiscal: z.coerce.number().int().min(2024).max(2100),
    tipo_documento: z.enum(FISCAL_TIPOS_DOCUMENTO),
    cliente_nome: z.string().trim().min(1).max(255),
    payment_mechanism: z.enum(FISCAL_PAYMENT_MECHANISM_CODES).optional(),
    documento_origem_id: z.string().uuid().optional(),
    rectifica_documento_id: z.string().uuid().optional(),
    itens: z.array(fiscalDocumentoUiItemSchema).min(1).max(500),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_documento === "RC" && !data.payment_mechanism) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment_mechanism"],
        message: "payment_mechanism é obrigatório para recibos (RC).",
      });
    }
    if (data.tipo_documento === "NC" && !data.rectifica_documento_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rectifica_documento_id"],
        message: "rectifica_documento_id é obrigatório para nota de crédito (NC).",
      });
    }
    if (data.tipo_documento === "ND" && !data.documento_origem_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documento_origem_id"],
        message: "documento_origem_id é obrigatório para nota de débito (ND).",
      });
    }
  });

export const postFiscalDocumentoRequestSchema = z.union([
  postFiscalDocumentoSchema,
  postFiscalDocumentoUiSchema,
]);

export const fiscalDocumentoActionSchema = z.object({
  motivo: z.string().trim().min(3).max(1000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PostFiscalDocumentoInput = z.infer<typeof postFiscalDocumentoSchema>;
export type PostFiscalDocumentoUiInput = z.infer<typeof postFiscalDocumentoUiSchema>;
export type PostFiscalDocumentoRequestInput = z.infer<typeof postFiscalDocumentoRequestSchema>;
export type FiscalDocumentoActionInput = z.infer<typeof fiscalDocumentoActionSchema>;
