BEGIN;

-- Adiciona suporte a rastreamento da linha de origem do CSV
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS row_number integer;

-- Preenche linhas existentes para evitar valores nulos em imports já carregados
UPDATE public.staging_alunos sa
SET row_number = sub.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY import_id ORDER BY id) AS rn
  FROM public.staging_alunos
) sub
WHERE sa.id = sub.id
  AND sa.row_number IS NULL;

COMMIT;
