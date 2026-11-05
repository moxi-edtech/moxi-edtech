import { z } from "zod";

const motivo = z.string().trim().min(15, "Explique o motivo com pelo menos 15 caracteres.").max(1000);
const uuid = z.string().uuid();
const base = { matricula_id: uuid, motivo };
export const balcaoAcademicOperation = z.discriminatedUnion("acao", [
  z.object({ ...base, acao: z.literal("registar_eja"), disciplina_id: uuid,
    suficiente: z.boolean(), documento_fonte: z.string().trim().min(5).max(1000), expected_id: uuid.nullable() }).strict(),
  z.object({ ...base, acao: z.literal("reabrir_periodo"), disciplina_id: uuid, periodo_id: uuid }).strict(),
  z.object({ ...base, acao: z.literal("validar_exame"), resultado_id: uuid }).strict(),
  z.object({ ...base, acao: z.literal("publicar_exame"), sessao_id: uuid }).strict(),
  z.object({ ...base, acao: z.literal("abrir_exame"), tipo: z.enum(["recurso", "extraordinario"]),
    modalidade: z.enum(["simples", "escrita_oral", "oral_pratica"]), data_inicio: z.string().date(), data_fim: z.string().date(),
    componentes: z.array(z.object({ codigo: z.enum(["escrita", "oral", "pratica"]), peso: z.number().positive().max(100) }).strict()).min(1).max(2) }).strict(),
  z.object({ ...base, acao: z.literal("publicar_pauta"), periodo_id: uuid, tipo: z.enum(["anual", "trimestral"]) }).strict(),
]);
export type BalcaoAcademicOperation = z.infer<typeof balcaoAcademicOperation>;
export const BALCAO_ACADEMIC_MANAGER_ROLES = ["admin", "admin_escola", "diretor", "secretaria", "admin_secretaria", "secretaria_financeiro"] as const;
export function canManageBalcaoAcademic(role: unknown) {
  return BALCAO_ACADEMIC_MANAGER_ROLES.some((allowed) => role === allowed);
}
