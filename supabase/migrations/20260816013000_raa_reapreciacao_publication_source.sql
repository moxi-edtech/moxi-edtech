BEGIN;

ALTER TABLE public.reapreciacao_pedidos
  ADD COLUMN IF NOT EXISTS resultado_publicado_em timestamptz;

COMMENT ON COLUMN public.reapreciacao_pedidos.resultado_publicado_em IS
  'Timestamp da pauta oficial publicada que iniciou o prazo regulamentar de reapreciação.';

COMMIT;
