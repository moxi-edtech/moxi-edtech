-- Migration: 20270312090000_portal_aluno_perf_indexes.sql
-- Descrição: Índices para acelerar consultas do portal do aluno.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matriculas_escola_aluno_created_at
  ON public.matriculas (escola_id, aluno_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_escola_matricula_created_at
  ON public.notas (escola_id, matricula_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mensalidades_escola_aluno_venc
  ON public.mensalidades (escola_id, aluno_id, data_vencimento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsp_escola_matricula_periodo
  ON public.frequencia_status_periodo (escola_id, matricula_id, periodo_letivo_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_boletim_escola_matricula_disciplina_nome
  ON internal.mv_boletim_por_matricula (escola_id, matricula_id, disciplina_nome);
