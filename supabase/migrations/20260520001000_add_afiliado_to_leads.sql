BEGIN;
  ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS afiliado_codigo TEXT;
  CREATE INDEX IF NOT EXISTS idx_marketing_leads_afiliado ON public.marketing_leads(afiliado_codigo);
COMMIT;
