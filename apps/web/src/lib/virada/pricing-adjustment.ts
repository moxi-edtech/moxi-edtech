import { z } from "zod";

export const PricingAdjustmentSchema = z.object({
  percentual: z.number().min(-100).max(500).default(0),
  arredondar_para: z.number().int().positive().max(10_000).default(1),
  overrides: z.record(z.string().uuid(), z.object({
    valor_matricula: z.number().min(0).optional(),
    valor_mensalidade: z.number().min(0).optional(),
  })).default({}),
});

export type PricingAdjustment = z.infer<typeof PricingAdjustmentSchema>;

export type PricingSource = {
  id: string;
  curso_id: string | null;
  classe_id: string | null;
  valor_matricula: number | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  multa_atraso_percentual: number | null;
  multa_diaria: number | null;
};

function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

function adjusted(value: number | null, percentual: number, increment: number) {
  if (value == null) return null;
  return roundTo(value * (1 + percentual / 100), increment);
}

export function buildPricingProposal(rows: PricingSource[], rawInput: unknown) {
  const input = PricingAdjustmentSchema.parse(rawInput);

  return rows.map((row) => {
    const override = input.overrides[row.id];
    const valorMatricula = override?.valor_matricula
      ?? adjusted(row.valor_matricula, input.percentual, input.arredondar_para);
    const valorMensalidade = override?.valor_mensalidade
      ?? adjusted(row.valor_mensalidade, input.percentual, input.arredondar_para);

    return {
      origem_id: row.id,
      curso_id: row.curso_id,
      classe_id: row.classe_id,
      valor_matricula_anterior: row.valor_matricula,
      valor_matricula_proposto: valorMatricula,
      valor_mensalidade_anterior: row.valor_mensalidade,
      valor_mensalidade_proposto: valorMensalidade,
      dia_vencimento: row.dia_vencimento,
      multa_atraso_percentual: row.multa_atraso_percentual,
      multa_diaria: row.multa_diaria,
      alterado_manualmente: Boolean(override),
    };
  });
}
