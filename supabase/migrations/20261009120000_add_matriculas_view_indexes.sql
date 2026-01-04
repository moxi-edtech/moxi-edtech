BEGIN;

-- Índice composto para filtros da view e ordenação
CREATE INDEX IF NOT EXISTS idx_matriculas_escola_session_ano_created_at
  ON public.matriculas (escola_id, session_id, ano_letivo, created_at DESC);

-- Índice para consultas apenas por ano letivo
CREATE INDEX IF NOT EXISTS idx_matriculas_escola_ano_created_at
  ON public.matriculas (escola_id, ano_letivo, created_at DESC);

COMMIT;
