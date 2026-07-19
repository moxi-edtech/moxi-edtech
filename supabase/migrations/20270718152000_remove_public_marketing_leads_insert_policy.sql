BEGIN;

DROP POLICY IF EXISTS "Enable insert for everyone" ON public.marketing_leads;
REVOKE INSERT ON TABLE public.marketing_leads FROM PUBLIC, anon, authenticated;

COMMIT;
