-- Tenant-scope browser Web Push subscriptions. Prevent cross-school inserts
-- via direct PostgREST even when the Next.js endpoint is bypassed.
-- The school access function reads authenticated school associations, never
-- client-editable user_metadata. No service-role grants are added.
BEGIN;

ALTER TABLE public.aluno_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own subscriptions"
  ON public.aluno_push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_own_authorized_school
  ON public.aluno_push_subscriptions;

CREATE POLICY push_subscriptions_own_authorized_school
  ON public.aluno_push_subscriptions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.has_access_to_escola_fast(escola_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.has_access_to_escola_fast(escola_id)
  );

COMMIT;
