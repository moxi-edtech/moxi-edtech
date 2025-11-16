-- Fix RLS policies to avoid per-row re-evaluation of auth.* in initplans
-- Replaces direct auth.uid() calls with (select auth.uid()) in policies

BEGIN;

-- TURMAS policies: wrap auth.uid() in SELECT
DO $$
BEGIN
  IF to_regclass('public.turmas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "select_own_turmas" ON public.turmas';
    EXECUTE 'CREATE POLICY "select_own_turmas" ON public.turmas FOR SELECT
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'DROP POLICY IF EXISTS "insert_own_turmas" ON public.turmas';
    EXECUTE 'CREATE POLICY "insert_own_turmas" ON public.turmas FOR INSERT
             WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'DROP POLICY IF EXISTS "update_own_turmas" ON public.turmas';
    EXECUTE 'CREATE POLICY "update_own_turmas" ON public.turmas FOR UPDATE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';

    EXECUTE 'DROP POLICY IF EXISTS "delete_own_turmas" ON public.turmas';
    EXECUTE 'CREATE POLICY "delete_own_turmas" ON public.turmas FOR DELETE
             USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
  END IF;
END$$;

-- AUDIT_LOGS policies: wrap auth.uid()
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs';
    EXECUTE 'CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
             AS PERMISSIVE FOR INSERT TO authenticated
             WITH CHECK ((SELECT auth.uid()) IS NOT NULL)';

    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_select_by_scope" ON public.audit_logs';
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

-- CLASSES select policy: avoid direct auth.* usage
DO $$
BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "classes select membros escola" ON public.classes';
    EXECUTE 'CREATE POLICY "classes select membros escola" ON public.classes FOR SELECT
             USING (
               EXISTS (
                 SELECT 1 FROM public.escola_usuarios eu
                 WHERE eu.escola_id = classes.escola_id
                   AND eu.user_id = (SELECT auth.uid())
               )
             )';
  END IF;
END$$;

-- DISCIPLINAS select policy: avoid direct auth.* usage
DO $$
BEGIN
  IF to_regclass('public.disciplinas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "disciplinas select membros escola" ON public.disciplinas';
    EXECUTE 'CREATE POLICY "disciplinas select membros escola" ON public.disciplinas FOR SELECT
             USING (
               EXISTS (
                 SELECT 1 FROM public.escola_usuarios eu
                 WHERE eu.escola_id = disciplinas.escola_id
                   AND eu.user_id = (SELECT auth.uid())
               )
             )';
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

