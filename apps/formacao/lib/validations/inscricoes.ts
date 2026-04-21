import * as z from "zod";

export const aprovarInscricaoSchema = z.object({
  id: z.string().uuid("ID de inscrição inválido"),
});

export const rejeitarInscricaoSchema = z.object({
  id: z.string().uuid("ID de inscrição inválido"),
  motivo: z.string().min(5, "O motivo deve ter pelo menos 5 caracteres"),
});

export const reenviarAcessoSchema = z.object({
  email: z.string().email("E-mail inválido"),
  inscricao_id: z.string().uuid().optional(),
});

export type AprovarInscricaoInput = z.infer<typeof aprovarInscricaoSchema>;
export type RejeitarInscricaoInput = z.infer<typeof rejeitarInscricaoSchema>;
export type ReenviarAcessoInput = z.infer<typeof reenviarAcessoSchema>;
