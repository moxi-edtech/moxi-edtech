BEGIN;

-- Permite matrículas pendentes sem turma
ALTER TABLE public.matriculas
  ALTER COLUMN turma_id DROP NOT NULL;

-- Remove vínculo de turma para matrículas que ficaram "pendente" após o patch de status/número.
UPDATE public.matriculas
SET turma_id = NULL,
    numero_chamada = NULL
WHERE status = 'pendente'
  AND turma_id IS NOT NULL;

COMMIT;
