import * as z from "zod";

export const mentoriaSchema = z
  .object({
    nome: z.string().min(5, "O nome da mentoria deve ter pelo menos 5 caracteres"),
    preco: z.coerce.number().min(0, "O preço não pode ser negativo"),
    modalidade: z.enum(["ONLINE", "GRAVADO", "PRESENCIAL"]),
    data_inicio: z.string().min(1, "A data de início é obrigatória"),
    localizacao: z.string().optional(),
    vagas_limite: z.coerce.number().optional(),
  })
  .refine(
    (data) => {
      if (data.modalidade === "PRESENCIAL") {
        return !!data.localizacao && data.localizacao.length >= 5;
      }
      return true;
    },
    {
      message: "A localização é obrigatória para eventos presenciais (min. 5 caracteres)",
      path: ["localizacao"],
    }
  )
  .refine(
    (data) => {
      if (data.modalidade === "PRESENCIAL") {
        return !!data.vagas_limite && data.vagas_limite >= 1;
      }
      return true;
    },
    {
      message: "O limite de vagas é obrigatório para eventos presenciais",
      path: ["vagas_limite"],
    }
  );

export type MentoriaInput = z.infer<typeof mentoriaSchema>;
