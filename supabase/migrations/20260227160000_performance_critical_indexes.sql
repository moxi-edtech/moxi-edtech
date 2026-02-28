-- Migration: 20260227160000_performance_critical_indexes.sql
-- Descrição: Criação dos 7 índices críticos para performance multi-tenant em escala de 100 escolas.
-- Nota: Usando CREATE INDEX CONCURRENTLY para não bloquear as tabelas em produção.

-- 1. Dashboard de Matrículas (P0)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matriculas_escola_ano_status 
  ON public.matriculas (escola_id, ano_letivo, status);

-- 2. Radar de Inadimplência (P0)
-- Nota: Substituindo o uso de date_trunc por um índice direto na data_vencimento.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financeiro_lancamentos_escola_vencimento_status 
  ON public.financeiro_lancamentos (escola_id, data_vencimento, status);

-- 3. Extrato de Alunos e Mensalidades (P0)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mensalidades_escola_aluno_status 
  ON public.mensalidades (escola_id, aluno_id, status);

-- 4. Busca Rápida de Alunos (UX/Harmonia)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alunos_escola_nome_status 
  ON public.alunos (escola_id, nome, status) 
  WHERE deleted_at IS NULL;

-- 5. Listagem de Turmas por Curso (Secretaria)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_turmas_escola_curso_status 
  ON public.turmas (escola_id, curso_id, status);

-- 6. Notas e Boletins (Pedagógico)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_escola_periodo_disciplina 
  ON public.notas (escola_id, periodo_letivo_id, disciplina_id);

-- 7. Polling do Outbox Worker (Infra)
-- Crítico para o Worker não fazer Seq Scan na tabela de eventos que cresce rápido.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_events_worker_polling 
  ON public.outbox_events (status, next_attempt_at) 
  WHERE status IN ('pending', 'failed');
