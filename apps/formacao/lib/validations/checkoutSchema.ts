import * as z from "zod";

export const checkoutSchema = z.object({
  nome_completo: z.string().min(3, "Nome completo é obrigatório."),
  identificacao: z.string().min(6, "Identificação inválida."),
  telefone: z.string().min(9, "Telefone inválido."),
  comprovativo_url: z.string().url("Comprovativo inválido."),
});

export type CheckoutSchemaInput = z.infer<typeof checkoutSchema>;

