-- Ajusta tabela legado que não possui todas as colunas usadas pela API
ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS escola_id uuid,
  ADD COLUMN IF NOT EXISTS ano_letivo int,
  ADD COLUMN IF NOT EXISTS curso_id uuid,
  ADD COLUMN IF NOT EXISTS classe_id uuid,
  ADD COLUMN IF NOT EXISTS dia_vencimento int DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31);

-- Índice auxiliar para filtros por escola/ano (idempotente)
CREATE INDEX IF NOT EXISTS idx_fin_tabelas_escola_ano ON public.financeiro_tabelas (escola_id, ano_letivo);
