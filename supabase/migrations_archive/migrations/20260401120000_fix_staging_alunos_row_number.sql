BEGIN;

-- Garante que a coluna row_number existe (ambientes que não rodaram 20251226090000)
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS row_number integer;

-- Preenche valores faltantes para manter referência das linhas importadas
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY import_id ORDER BY id) AS rn
  FROM public.staging_alunos
)
UPDATE public.staging_alunos sa
SET row_number = n.rn
FROM numbered n
WHERE sa.id = n.id
  AND sa.row_number IS NULL;

-- Força o PostgREST a recarregar o cache de esquema
NOTIFY pgrst, 'reload schema';

COMMIT;
