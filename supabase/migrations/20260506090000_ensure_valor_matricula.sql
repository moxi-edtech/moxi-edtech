-- Garante que a coluna valor_matricula exista em financeiro_tabelas
ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS valor_matricula numeric(12,2) NOT NULL DEFAULT 0;
