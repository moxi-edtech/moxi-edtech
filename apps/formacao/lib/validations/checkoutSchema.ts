import * as z from "zod";

export const checkoutSchema = z.object({
  nome_completo: z.string().min(3, "Nome completo é obrigatório."),
  email: z.string().email("E-mail inválido."),
  bi_passaporte: z
    .string()
    .trim()
    .toUpperCase()
    .min(9, "Nº de Identificação deve ter pelo menos 9 caracteres.")
    .max(14, "Nº de Identificação não pode exceder 14 caracteres."),
  telefone: z.string().min(9, "Telefone inválido."),
  comprovativo_url: z.string().url("Comprovativo inválido."),
});

export type CheckoutSchemaInput = z.infer<typeof checkoutSchema>;

