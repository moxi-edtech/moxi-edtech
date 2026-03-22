BEGIN;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS provincia text;

COMMIT;
