import { z } from "zod";

export const IDIOMAS = [
  { value: "en", label: "Inglês" },
  { value: "fr", label: "Francês" },
  { value: "es", label: "Espanhol" },
  { value: "other", label: "Outro idioma" },
] as const;

export const idiomaSchema = z.discriminatedUnion("idioma", [
  z.object({ idioma: z.literal("en"), outro: z.null().optional() }).strict(),
  z.object({ idioma: z.literal("fr"), outro: z.null().optional() }).strict(),
  z.object({ idioma: z.literal("es"), outro: z.null().optional() }).strict(),
  z.object({
    idioma: z.literal("other"),
    outro: z.string().trim().min(2).max(80).refine((value) => !/[\x00-\x1f\x7f-\x9f]/.test(value), "Idioma inválido"),
  }).strict(),
]);

export type Idioma = (typeof IDIOMAS)[number]["value"];
export type IdiomaConfig = { idioma: Idioma | null; outro: string | null };

export function isLinguaEstrangeira(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase() === "lingua estrangeira";
}
