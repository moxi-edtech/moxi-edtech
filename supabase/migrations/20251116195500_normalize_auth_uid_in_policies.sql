-- Normalize auth.uid() usage across RLS policies by wrapping as (SELECT auth.uid())
-- and aligning UPDATE policies to include both USING and WITH CHECK.

BEGIN;

-- TURMAS
DO $$
BEGIN
  IF to_regclass('public.turmas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY';

    -- Replace own_* policies with consistent pattern
    EXECUTE 'DROP POLICY IF EXISTS "select_own_turmas" ON public.turmas';
    EXECUTE 'DROP POLICY IF EXISTS "insert_own_turmas" ON public.turmas';
    EXECUTE 'DROP POLICY IF EXISTS "update_own_turmas" ON public.turmas';
    EXECUTE 'DROP POLICY IF EXISTS "delete_own_turmas" ON public.turmas';

    EXECUTE 'CREATE POLICY "select_own_turmas" ON public.turmas FOR SELECT
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "insert_own_turmas" ON public.turmas FOR INSERT
             WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "update_own_turmas" ON public.turmas FOR UPDATE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))
             WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "delete_own_turmas" ON public.turmas FOR DELETE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
  END IF;
END$$;

-- DISCIPLINAS
DO $$
BEGIN
  IF to_regclass('public.disciplinas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "select_own_disciplinas" ON public.disciplinas';
    EXECUTE 'DROP POLICY IF EXISTS "insert_own_disciplinas" ON public.disciplinas';
    EXECUTE 'DROP POLICY IF EXISTS "update_own_disciplinas" ON public.disciplinas';
    EXECUTE 'DROP POLICY IF EXISTS "delete_own_disciplinas" ON public.disciplinas';

    EXECUTE 'CREATE POLICY "select_own_disciplinas" ON public.disciplinas FOR SELECT
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "insert_own_disciplinas" ON public.disciplinas FOR INSERT
             WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "update_own_disciplinas" ON public.disciplinas FOR UPDATE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))
             WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'CREATE POLICY "delete_own_disciplinas" ON public.disciplinas FOR DELETE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
  END IF;
END$$;

-- AUDIT_LOGS
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs';
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_select_by_scope" ON public.audit_logs';

    EXECUTE 'CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
             AS PERMISSIVE FOR INSERT TO authenticated
             WITH CHECK ((SELECT auth.uid()) IS NOT NULL)';

    EXECUTE 'CREATE POLICY "audit_logs_select_by_scope" ON public.audit_logs
             AS PERMISSIVE FOR SELECT TO authenticated
             USING (
               public.current_user_role() = ''super_admin''
               OR EXISTS (
                 SELECT 1 FROM public.escola_usuarios eu
                 WHERE eu.user_id = (SELECT auth.uid())
                   AND (eu.escola_id = audit_logs.escola_id OR audit_logs.escola_id IS NULL)
               )
             )';
  END IF;
END$$;

-- ONBOARDING_DRAFTS: ensure SELECT policy wraps auth.uid()
DO $$
BEGIN
  IF to_regclass('public.onboarding_drafts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS unified_select_onboarding_drafts ON public.onboarding_drafts';
    EXECUTE 'DROP POLICY IF EXISTS onboarding_drafts_select_own ON public.onboarding_drafts';
    EXECUTE 'CREATE POLICY unified_select_onboarding_drafts ON public.onboarding_drafts FOR SELECT
             USING ((SELECT auth.uid()) = user_id)';
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

