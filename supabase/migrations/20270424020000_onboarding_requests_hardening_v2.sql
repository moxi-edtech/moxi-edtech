BEGIN;

ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.onboarding_requests
SET source = 'landing_web'
WHERE source IS NULL OR btrim(source) = '';

ALTER TABLE public.onboarding_requests
  ALTER COLUMN source SET DEFAULT 'landing_web';

-- enforce a controlled source set for new and existing rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'onboarding_requests'
      AND c.conname = 'onboarding_requests_source_check'
  ) THEN
    ALTER TABLE public.onboarding_requests
      ADD CONSTRAINT onboarding_requests_source_check
      CHECK (source IN ('landing_web', 'public_form', 'super_admin_manual'));
  END IF;
END $$;

-- Replace policy with stronger request envelope checks while preserving public onboarding intake.
DROP POLICY IF EXISTS onboarding_insert_public ON public.onboarding_requests;
CREATE POLICY onboarding_insert_public
ON public.onboarding_requests
FOR INSERT
TO public
WITH CHECK (
  status = 'pendente'
  AND length(btrim(coalesce(escola_nome, ''))) BETWEEN 3 AND 200
  AND length(regexp_replace(coalesce(escola_nif, ''), '\\D', '', 'g')) = 9
  AND (
    coalesce(btrim(escola_email), '') = ''
    OR escola_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  )
  AND coalesce(source, 'landing_web') IN ('landing_web', 'public_form', 'super_admin_manual')
  AND created_at >= now() - interval '1 day'
  AND created_at <= now() + interval '5 minutes'
);

COMMIT;
