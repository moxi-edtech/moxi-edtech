BEGIN;

ALTER TABLE public.pautas_oficiais
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'trimestral'::text NOT NULL;

DROP INDEX IF EXISTS public.uq_pautas_oficiais_lookup;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pautas_oficiais_lookup
  ON public.pautas_oficiais (escola_id, turma_id, periodo_letivo_id, tipo);

COMMIT;
