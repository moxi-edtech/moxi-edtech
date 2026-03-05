BEGIN;

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS motivo_fecho text NULL,
  ADD COLUMN IF NOT EXISTS data_fecho timestamptz NULL,
  ADD COLUMN IF NOT EXISTS status_fecho_origem text NULL,
  ADD COLUMN IF NOT EXISTS origem_transicao_matricula_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matriculas_origem_transicao_fk'
  ) THEN
    ALTER TABLE public.matriculas
      ADD CONSTRAINT matriculas_origem_transicao_fk
      FOREIGN KEY (origem_transicao_matricula_id)
      REFERENCES public.matriculas(id)
      ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;
