import { z } from "zod";

export const postFiscalSaftExportSchema = z
  .object({
    empresa_id: z.string().uuid(),
    periodo_inicio: z.string().date(),
    periodo_fim: z.string().date(),
    xsd_version: z.string().trim().min(1).max(32).default("AO_SAFT_1.01"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    const inicio = new Date(`${data.periodo_inicio}T00:00:00.000Z`);
    const fim = new Date(`${data.periodo_fim}T00:00:00.000Z`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return;
    }

    if (fim < inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodo_fim"],
        message: "periodo_fim deve ser maior ou igual a periodo_inicio",
      });
      return;
    }

    const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;
    if (fim.getTime() - inicio.getTime() > ONE_YEAR_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodo_fim"],
        message: "Período máximo permitido é de 12 meses.",
      });
    }
  });

export type PostFiscalSaftExportInput = z.infer<typeof postFiscalSaftExportSchema>;
