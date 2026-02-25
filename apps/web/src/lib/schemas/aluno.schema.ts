import { z } from "zod";

export const alunoListFiltersSchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  ano: z.coerce.number().int().optional(),
  turmaId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  cursorCreatedAt: z.string().min(1).optional(),
  cursorId: z.string().uuid().optional(),
  situacaoFinanceira: z.string().trim().min(1).optional(),
  statusMatricula: z.string().trim().min(1).optional(),
  includeResumo: z.boolean().optional(),
});

export type AlunoListFilters = z.infer<typeof alunoListFiltersSchema>;

export const alunoListItemSchema = z.object({
  id: z.string(),
  aluno_id: z.string().nullable().optional(),
  origem: z.string().optional(),
  nome: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  telefone_responsavel: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  numero_login: z.string().nullable().optional(),
  numero_processo: z.string().nullable().optional(),
  turma_nome: z.string().nullable().optional(),
  turma_id: z.string().nullable().optional(),
  turma_codigo: z.string().nullable().optional(),
  turma_ano: z.number().nullable().optional(),
  turma_curso: z.string().nullable().optional(),
  situacao_financeira: z.string().nullable().optional(),
  meses_atraso: z.number().optional(),
  valor_em_divida: z.number().optional(),
  status_matricula: z.string().nullable().optional(),
  total_em_atraso: z.number().optional(),
});

export type AlunoListItem = z.infer<typeof alunoListItemSchema>;
