import { z } from "zod";
import type { Role } from "@/lib/authz";

export const toolSchemas = {
  buscar_aluno: z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(25).default(10) }),
  listar_inadimplencia: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
  resumo_financeiro: z.object({ start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  professores_com_notas: z.object({ start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  frequencia_turma: z.object({ class_id: z.string().uuid(), start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  situacao_academica_aluno: z.object({ student_id: z.string().uuid() }),
} as const;

export type KlasseToolName = keyof typeof toolSchemas;
export const isKlasseToolName = (value: string): value is KlasseToolName => value in toolSchemas;

const admin = ["admin", "staff_admin", "admin_escola"] as const satisfies readonly Role[];
const secretaria = ["admin_secretaria", "secretaria", "secretaria_financeiro", "admin_financeiro"] as const satisfies readonly Role[];

export const allowedRolesByTool: Record<KlasseToolName, Role[]> = {
  buscar_aluno: [...admin, ...secretaria, "financeiro"],
  listar_inadimplencia: [...admin, ...secretaria, "financeiro"],
  resumo_financeiro: [...admin, ...secretaria, "financeiro"],
  professores_com_notas: [...admin, ...secretaria],
  frequencia_turma: [...admin, ...secretaria, "professor"],
  situacao_academica_aluno: [...admin, ...secretaria, "professor"],
};
