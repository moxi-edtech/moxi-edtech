BEGIN;

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS metadata_json JSONB;

COMMIT;
