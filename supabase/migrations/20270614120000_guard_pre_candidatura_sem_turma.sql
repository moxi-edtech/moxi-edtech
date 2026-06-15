BEGIN;

ALTER TABLE public.candidaturas
  DROP CONSTRAINT IF EXISTS candidaturas_pre_candidatura_sem_turma;

ALTER TABLE public.candidaturas
  ADD CONSTRAINT candidaturas_pre_candidatura_sem_turma
  CHECK (
    status <> 'pre_candidatura'
    OR turma_preferencial_id IS NULL
  ) NOT VALID;

COMMIT;
