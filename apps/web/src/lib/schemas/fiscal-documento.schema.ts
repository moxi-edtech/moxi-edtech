import { z } from "zod";

export const FISCAL_ORIGENS_DOCUMENTO = [
  "interno",
  "manual_recuperado",
  "integrado",
  "formacao",
  "contingencia",
] as const;

export const FISCAL_TIPOS_DOCUMENTO = ["FR", "FT", "NC", "ND", "RC"] as const;

export const fiscalDocumentoItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  quantidade: z.coerce.number().positive(),
  preco_unit: z.coerce.number().min(0),
  taxa_iva: z.coerce.number().min(0).max(100),
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
  });

export const postFiscalDocumentoUiSchema = z.object({
  ano_fiscal: z.coerce.number().int().min(2024).max(2100),
  tipo_documento: z.enum(["FT", "FR"]),
  cliente_nome: z.string().trim().min(1).max(255),
  itens: z.array(fiscalDocumentoUiItemSchema).min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
