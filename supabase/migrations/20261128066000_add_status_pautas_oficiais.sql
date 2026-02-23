BEGIN;

ALTER TABLE public.pautas_oficiais
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'SUCCESS'::text NOT NULL,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS idx_pautas_oficiais_status
  ON public.pautas_oficiais (status);

COMMIT;
