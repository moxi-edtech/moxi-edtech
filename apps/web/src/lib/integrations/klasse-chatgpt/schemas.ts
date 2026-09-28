import { z } from "zod";
import type { Role } from "@/lib/authz";

export const toolSchemas = {
  buscar_aluno: z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(25).default(10) }),
  listar_inadimplencia: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
  resumo_financeiro: z.object({ start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  professores_com_notas: z.object({ start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  frequencia_turma: z.object({ class_id: z.string().uuid(), start_date: z.string().date().optional(), end_date: z.string().date().optional() }),
  situacao_academica_aluno: z.object({ student_id: z.string().uuid() }),

  // --- Escrita -----------------------------------------------------------------
  // Nenhum destes aceita escola_id: o tenant vem do JWT. Ver AGENTS.md.
  lancar_frequencia: z.object({
    turma_id: z.string().uuid(),
    disciplina_id: z.string().uuid(),
    data: z.string().date(),
    presencas: z
      .array(
        z.object({
          aluno_id: z.string().uuid(),
          status: z.enum(["presente", "ausente", "atrasado", "falta", "justificada"]),
        }),
      )
      .min(1)
      .max(200),
  }),
  lancar_notas: z.object({
    turma_id: z.string().uuid(),
    disciplina_id: z.string().uuid(),
    turma_disciplina_id: z.string().uuid(),
    trimestre: z.number().int().min(1).max(3),
    tipo_avaliacao: z.string().trim().min(1).max(20).default("MAC"),
    // Escala 0–20, a usada em produção.
    notas: z
      .array(z.object({ aluno_id: z.string().uuid(), valor: z.number().min(0).max(20) }))
      .min(1)
      .max(200),
    is_isento: z.boolean().default(false),
  }),
  // Primeiro tempo: não cobra nada, devolve um token de uso único.
  preparar_pagamento: z.object({
    aluno_id: z.string().uuid(),
    mensalidade_id: z.string().uuid(),
    valor: z.number().positive().optional(),
    metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kwik", "kiwk"]).default("cash"),
  }),
  // Segundo tempo: executa. Reenviar o mesmo token não cobra duas vezes.
  confirmar_pagamento: z.object({ token: z.string().uuid() }),
  confirmacoes_pendentes: z.object({}),
} as const;

/** Ferramentas que alteram estado. As restantes são de leitura. */
export const writeToolNames = [
  "lancar_frequencia",
  "lancar_notas",
  "preparar_pagamento",
  "confirmar_pagamento",
] as const satisfies readonly KlasseToolName[];

export const isWriteToolName = (value: KlasseToolName): boolean =>
  (writeToolNames as readonly string[]).includes(value);

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

  // --- Escrita -----------------------------------------------------------------
  // Espelham exactamente os arrays que as RPCs auditadas exigem por dentro.
  // A autoridade final é o SQL: se divergirem, a chamada falha, não passa.
  lancar_frequencia: [...admin, "professor"],
  lancar_notas: [...admin, ...secretaria, "professor"],
  preparar_pagamento: [...admin, ...secretaria, "financeiro"],
  confirmar_pagamento: [...admin, ...secretaria, "financeiro"],
  confirmacoes_pendentes: [...admin, ...secretaria, "financeiro"],
};
