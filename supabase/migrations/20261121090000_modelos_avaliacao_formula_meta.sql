BEGIN;

ALTER TABLE public.modelos_avaliacao
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'trimestral',
  ADD COLUMN IF NOT EXISTS regras jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS formula jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.modelos_avaliacao
  DROP CONSTRAINT IF EXISTS modelos_avaliacao_tipo_check,
  ADD CONSTRAINT modelos_avaliacao_tipo_check
    CHECK (tipo IN ('trimestral', 'pap', 'estagio', 'isencao', 'final_unica'));

UPDATE public.modelos_avaliacao
  SET tipo = 'trimestral'
WHERE tipo IS NULL OR tipo = '';

CREATE INDEX IF NOT EXISTS modelos_avaliacao_escola_tipo_idx
  ON public.modelos_avaliacao (escola_id, tipo);

COMMIT;
