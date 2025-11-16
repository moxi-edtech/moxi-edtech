-- Standardize public.classes RLS policies and wrap auth calls consistently

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY';

    -- Drop and recreate to enforce single, consistent policy per action
    EXECUTE 'DROP POLICY IF EXISTS "select_own_classes" ON public.classes';
    EXECUTE 'DROP POLICY IF EXISTS "insert_own_classes" ON public.classes';
    EXECUTE 'DROP POLICY IF EXISTS "update_own_classes" ON public.classes';
    EXECUTE 'DROP POLICY IF EXISTS "delete_own_classes" ON public.classes';

    -- SELECT
    EXECUTE 'CREATE POLICY "select_own_classes" ON public.classes FOR SELECT
             USING (
               escola_id = (
                 SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
               )
             )';

    -- INSERT
    EXECUTE 'CREATE POLICY "insert_own_classes" ON public.classes FOR INSERT
             WITH CHECK (
               escola_id = (
                 SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
               )
             )';

    -- UPDATE (ensure USING and WITH CHECK)
    EXECUTE 'CREATE POLICY "update_own_classes" ON public.classes FOR UPDATE
             USING (
               escola_id = (
                 SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
               )
             )
             WITH CHECK (
               escola_id = (
                 SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
               )
             )';

    -- DELETE
    EXECUTE 'CREATE POLICY "delete_own_classes" ON public.classes FOR DELETE
             USING (
               escola_id = (
                 SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
               )
             )';
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

