-- Fix RLS for public.alunos: allow school members to read/write within their escola
-- Aligns with policies used for turmas/disciplinas (profiles.escola_id based)

-- Ensure table exists before applying (idempotent-friendly checks kept simple)
DO $$ BEGIN
  IF to_regclass('public.alunos') IS NULL THEN
    RAISE NOTICE 'Table public.alunos not found, skipping RLS policy setup.';
    RETURN;
  END IF;
END $$;

-- Enable RLS and force it (safe to re-run)
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos FORCE ROW LEVEL SECURITY;

-- Drop any conflicting policies to avoid duplicates on re-apply
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'alunos'
      AND policyname IN (
        'tenant_isolation',
        'Tenant Isolation',
        'alunos_select_own',
        'alunos_insert_own',
        'alunos_update_own',
        'alunos_delete_own'
      )
  ) THEN
    DROP POLICY IF EXISTS "tenant_isolation" ON public.alunos;
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_select_own" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_insert_own" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_update_own" ON public.alunos;
    DROP POLICY IF EXISTS "alunos_delete_own" ON public.alunos;
  END IF;
END $$;

-- Policy: SELECT within own escola
CREATE POLICY "alunos_select_own"
  ON public.alunos
  FOR SELECT
  USING (
    escola_id = (
      SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
    )
  );

-- Policy: INSERT only into own escola
CREATE POLICY "alunos_insert_own"
  ON public.alunos
  FOR INSERT
  WITH CHECK (
    escola_id = (
      SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
    )
  );

-- Policy: UPDATE only within own escola
CREATE POLICY "alunos_update_own"
  ON public.alunos
  FOR UPDATE
  USING (
    escola_id = (
      SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    escola_id = (
      SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
    )
  );

-- Policy: DELETE only within own escola (optional but consistent)
CREATE POLICY "alunos_delete_own"
  ON public.alunos
  FOR DELETE
  USING (
    escola_id = (
      SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())
    )
  );

-- Typical grants (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT SELECT ON public.alunos TO anon;

