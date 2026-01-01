-- Índice para acelerar filtros/agregações por escola/status
-- Versão sem CONCURRENTLY para rodar dentro da transação do Supabase CLI

CREATE INDEX IF NOT EXISTS idx_matriculas_escola_status
  ON public.matriculas (escola_id, status);