BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_drafts'
      AND policyname = 'onboarding_drafts_insert_opt'
  ) THEN
    CREATE POLICY onboarding_drafts_insert_opt
      ON public.onboarding_drafts
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_drafts'
      AND policyname = 'onboarding_drafts_update_opt'
  ) THEN
    CREATE POLICY onboarding_drafts_update_opt
      ON public.onboarding_drafts
      FOR UPDATE
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_drafts'
      AND policyname = 'onboarding_drafts_delete_opt'
  ) THEN
    CREATE POLICY onboarding_drafts_delete_opt
      ON public.onboarding_drafts
      FOR DELETE
      TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

COMMIT;
