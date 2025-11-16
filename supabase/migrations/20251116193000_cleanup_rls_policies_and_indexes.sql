-- Consolidate RLS policies and remove duplicate indexes per Supabase linter
-- - Removes duplicate permissive policies on public.alunos and public.classes
-- - Keeps a single policy per action
-- - Removes duplicate indexes on classes.escola_id and turmas(session_id, diretor_turma_id)

BEGIN;

-- =============== RLS: public.alunos ==================
DO $$
BEGIN
  IF to_regclass('public.alunos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY';

    -- Drop broad/duplicate policy if present (previous generic policy)
    EXECUTE 'DROP POLICY IF EXISTS "acesso por membro da escola" ON public.alunos';

    -- Ensure one policy per action (keep existing alunos_*_own if already created)
    -- SELECT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='alunos' AND policyname='alunos_select_own'
    ) THEN
      EXECUTE 'CREATE POLICY "alunos_select_own" ON public.alunos FOR SELECT
               USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
    END IF;

    -- INSERT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='alunos' AND policyname='alunos_insert_own'
    ) THEN
      EXECUTE 'CREATE POLICY "alunos_insert_own" ON public.alunos FOR INSERT
               WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
    END IF;

    -- UPDATE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='alunos' AND policyname='alunos_update_own'
    ) THEN
      EXECUTE 'CREATE POLICY "alunos_update_own" ON public.alunos FOR UPDATE
               USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))
               WITH CHECK (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
    END IF;

    -- DELETE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='alunos' AND policyname='alunos_delete_own'
    ) THEN
      EXECUTE 'CREATE POLICY "alunos_delete_own" ON public.alunos FOR DELETE
               USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
    END IF;
  END IF;
END$$;

-- =============== RLS: public.classes ==================
DO $$
BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY';

    -- Drop duplicate SELECT policy variant to avoid multiple permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "classes select membros escola" ON public.classes';

    -- Ensure a single SELECT policy exists (keep select_own_classes)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='classes' AND policyname='select_own_classes'
    ) THEN
      EXECUTE 'CREATE POLICY "select_own_classes" ON public.classes FOR SELECT
               USING (escola_id = (SELECT escola_id FROM public.profiles WHERE user_id = (SELECT auth.uid())))';
    END IF;
  END IF;
END$$;

-- =============== Index cleanup ==================
-- Classes: keep idx_classes_escola_id, drop duplicate alias if present
DO $$
BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    -- Ensure the kept index exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='classes' AND indexname='idx_classes_escola_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_classes_escola_id ON public.classes(escola_id)';
    END IF;

    -- Drop the duplicate by different name
    IF EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='classes' AND indexname='classes_escola_id_idx'
    ) THEN
      EXECUTE 'DROP INDEX IF EXISTS public.classes_escola_id_idx';
    END IF;
  END IF;
END$$;

-- Turmas: keep *_id names, drop legacy duplicates
DO $$
BEGIN
  IF to_regclass('public.turmas') IS NOT NULL THEN
    -- session_id index: ensure kept name exists, drop old one
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='turmas' AND indexname='idx_turmas_session_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_turmas_session_id ON public.turmas(session_id)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='turmas' AND indexname='idx_turmas_session'
    ) THEN
      EXECUTE 'DROP INDEX IF EXISTS public.idx_turmas_session';
    END IF;

    -- diretor_turma_id index: ensure kept name exists, drop old one
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='turmas' AND indexname='idx_turmas_diretor_turma_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_turmas_diretor_turma_id ON public.turmas(diretor_turma_id)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='turmas' AND indexname='idx_turmas_diretor_turma'
    ) THEN
      EXECUTE 'DROP INDEX IF EXISTS public.idx_turmas_diretor_turma';
    END IF;
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

