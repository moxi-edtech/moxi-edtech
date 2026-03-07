BEGIN;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS gatilho text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS modal_id text,
  ADD COLUMN IF NOT EXISTS agrupamento_chave text,
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamp with time zone;

UPDATE public.notificacoes
SET
  gatilho = COALESCE(gatilho, 'H'),
  tipo = COALESCE(tipo, CASE WHEN action_url IS NOT NULL THEN 'A' ELSE 'I' END)
WHERE gatilho IS NULL OR tipo IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notificacoes_gatilho_check'
  ) THEN
    ALTER TABLE public.notificacoes
      ADD CONSTRAINT notificacoes_gatilho_check CHECK (gatilho IN ('H', 'S'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notificacoes_tipo_check'
  ) THEN
    ALTER TABLE public.notificacoes
      ADD CONSTRAINT notificacoes_tipo_check CHECK (tipo IN ('I', 'A'));
  END IF;
END $$;

COMMIT;
