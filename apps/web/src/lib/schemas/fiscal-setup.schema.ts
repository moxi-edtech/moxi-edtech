import { z } from "zod";

import {
  FISCAL_ORIGENS_DOCUMENTO,
  FISCAL_TIPOS_DOCUMENTO,
} from "@/lib/schemas/fiscal-documento.schema";

export const postFiscalEmpresaSchema = z.object({
  nome: z.string().trim().min(2).max(255),
  nif: z
    .string()
    .trim()
    .regex(/^\d{9,20}$/),
  endereco: z.string().trim().max(255).optional(),
  certificado_agt_numero: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const postFiscalBindingSchema = z
  .object({
    empresa_id: z.string().uuid(),
    escola_id: z.string().uuid().optional(),
    is_primary: z.boolean().optional().default(true),
    effective_from: z.string().date().optional(),
    effective_to: z.string().date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.effective_from && data.effective_to) {
      if (new Date(data.effective_to) < new Date(data.effective_from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effective_to"],
          message: "effective_to deve ser igual ou posterior a effective_from",
        });
      }
    }
  });

export const postFiscalSerieSchema = z.object({
  empresa_id: z.string().uuid(),
  tipo_documento: z.enum(FISCAL_TIPOS_DOCUMENTO),
  prefixo: z.string().trim().min(1).max(50),
  origem_documento: z.enum(FISCAL_ORIGENS_DOCUMENTO).default("interno"),
  ativa: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FISCAL_CHAVE_STATUS = ["pending", "active", "retired"] as const;

export const postFiscalChaveSchema = z.object({
  empresa_id: z.string().uuid(),
  key_version: z.coerce.number().int().positive(),
  public_key_pem: z.string().trim().min(1),
  private_key_ref: z.string().trim().min(1).optional(),
  key_fingerprint: z.string().trim().min(8).max(128),
  status: z.enum(FISCAL_CHAVE_STATUS).default("active"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PostFiscalEmpresaInput = z.infer<typeof postFiscalEmpresaSchema>;
export type PostFiscalBindingInput = z.infer<typeof postFiscalBindingSchema>;
export type PostFiscalSerieInput = z.infer<typeof postFiscalSerieSchema>;
export type PostFiscalChaveInput = z.infer<typeof postFiscalChaveSchema>;
