BEGIN;

ALTER TABLE public.candidaturas
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMIT;
