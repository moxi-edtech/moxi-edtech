BEGIN;

-- 1. Índice para buscar alunos rapidamente pelo nº de processo (por escola)
CREATE INDEX IF NOT EXISTS idx_alunos_escola_processo_hash 
  ON public.alunos USING btree (escola_id, numero_processo);

-- 2. Índice funcional para o SMART MATCH de turmas (código limpo em uppercase)
CREATE INDEX IF NOT EXISTS idx_turmas_smart_match 
  ON public.turmas (
    escola_id,
    ano_letivo,
    (upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')))
  );

-- 3. Índice para acelerar staging pelo import_id
CREATE INDEX IF NOT EXISTS idx_staging_import_id 
  ON public.staging_alunos (import_id);

COMMIT;
