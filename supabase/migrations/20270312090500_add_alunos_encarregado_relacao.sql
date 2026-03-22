BEGIN;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS encarregado_relacao text;

COMMIT;
