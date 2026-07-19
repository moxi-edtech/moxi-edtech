BEGIN;

REVOKE INSERT ON TABLE public.onboarding_doubts FROM anon, authenticated;

DROP POLICY IF EXISTS onboarding_doubts_insert_policy
  ON public.onboarding_doubts;

COMMIT;
