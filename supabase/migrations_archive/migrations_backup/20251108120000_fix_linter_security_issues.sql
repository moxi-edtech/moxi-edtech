-- Migration to fix security issues reported by Supabase Linter on 2025-11-08

BEGIN;

-- =================================================================
-- Part 1: Fix "Policy Exists RLS Disabled"
-- =================================================================

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =================================================================
-- Helper: apply_tenant_rls(table_name)
-- =================================================================

CREATE OR REPLACE FUNCTION apply_tenant_rls(tbl TEXT)
RETURNS void AS $func$
DECLARE
  v_table regclass;
  v_has_escola boolean;
BEGIN
  SELECT to_regclass(format('public.%I', tbl)) INTO v_table;
  IF v_table IS NULL THEN
    RAISE NOTICE 'Table public.% does not exist, skipping RLS', tbl;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = tbl
      AND column_name = 'escola_id'
  ) INTO v_has_escola;

  IF NOT v_has_escola THEN
    RAISE NOTICE 'Table public.% has no escola_id column, skipping tenant RLS', tbl;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
  EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I;', tbl);
  EXECUTE format(
    'CREATE POLICY "Tenant Isolation" ON public.%I
     FOR ALL
     USING (escola_id = current_tenant_escola_id())
     WITH CHECK (escola_id = current_tenant_escola_id());',
    tbl
  );
END;
$func$ LANGUAGE plpgsql;

-- =================================================================
-- Part 2: Add / backfill escola_id onde necessário
-- =================================================================

-- semestres
DO $$
BEGIN
  IF to_regclass('public.semestres') IS NOT NULL THEN
    ALTER TABLE public.semestres
      ADD COLUMN IF NOT EXISTS escola_id UUID;

    UPDATE public.semestres s
    SET escola_id = ss.escola_id
    FROM public.school_sessions ss
    WHERE s.session_id = ss.id
      AND s.escola_id IS NULL;

    -- Só força NOT NULL + FK se não sobrar lixo
    IF NOT EXISTS (
      SELECT 1 FROM public.semestres WHERE escola_id IS NULL
    ) THEN
      ALTER TABLE public.semestres
        ALTER COLUMN escola_id SET NOT NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'semestres_escola_fk_linter_fix'
          AND conrelid = 'public.semestres'::regclass
      ) THEN
        ALTER TABLE public.semestres
          ADD CONSTRAINT semestres_escola_fk_linter_fix
          FOREIGN KEY (escola_id)
          REFERENCES public.escolas(id)
          ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- secoes
DO $$
BEGIN
  IF to_regclass('public.secoes') IS NOT NULL THEN
    ALTER TABLE public.secoes
      ADD COLUMN IF NOT EXISTS escola_id UUID;

    UPDATE public.secoes s
    SET escola_id = t.escola_id
    FROM public.turmas t
    WHERE s.turma_id = t.id
      AND s.escola_id IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM public.secoes WHERE escola_id IS NULL
    ) THEN
      ALTER TABLE public.secoes
        ALTER COLUMN escola_id SET NOT NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'secoes_escola_fk_linter_fix'
          AND conrelid = 'public.secoes'::regclass
      ) THEN
        ALTER TABLE public.secoes
          ADD CONSTRAINT secoes_escola_fk_linter_fix
          FOREIGN KEY (escola_id)
          REFERENCES public.escolas(id)
          ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- matriculas
DO $$
BEGIN
  IF to_regclass('public.matriculas') IS NOT NULL THEN
    ALTER TABLE public.matriculas
      ADD COLUMN IF NOT EXISTS escola_id UUID;

    UPDATE public.matriculas m
    SET escola_id = t.escola_id
    FROM public.turmas t
    WHERE m.turma_id = t.id
      AND m.escola_id IS NULL;

    -- Só força NOT NULL se não houver registros órfãos
    IF NOT EXISTS (
      SELECT 1 FROM public.matriculas WHERE escola_id IS NULL
    ) THEN
      ALTER TABLE public.matriculas
        ALTER COLUMN escola_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- pagamentos
DO $$
BEGIN
  IF to_regclass('public.pagamentos') IS NOT NULL THEN
    ALTER TABLE public.pagamentos
      ADD COLUMN IF NOT EXISTS escola_id UUID;

    -- Só tenta usar matricula_id se existir
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pagamentos'
        AND column_name = 'matricula_id'
    ) THEN
      UPDATE public.pagamentos p
      SET escola_id = m.escola_id
      FROM public.matriculas m
      WHERE p.matricula_id = m.id
        AND p.escola_id IS NULL;
    END IF;

    -- Não força NOT NULL aqui para não quebrar dados existentes
  END IF;
END $$;

-- professores: garantir escola_id se fizer sentido
DO $$
BEGIN
  IF to_regclass('public.professores') IS NOT NULL THEN
    ALTER TABLE public.professores
      ADD COLUMN IF NOT EXISTS escola_id UUID;

    -- Só tenta herdar de profiles se a modelagem bater:
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'professores'
        AND column_name = 'user_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'user_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'escola_id'
    )
    THEN
      UPDATE public.professores p
      SET escola_id = pr.escola_id
      FROM public.profiles pr
      WHERE p.user_id = pr.user_id
        AND p.escola_id IS NULL;
    END IF;
  END IF;
END $$;

-- =================================================================
-- Apply tenant RLS where applicable
-- =================================================================

SELECT apply_tenant_rls('pagamentos');
SELECT apply_tenant_rls('school_sessions');
SELECT apply_tenant_rls('semestres');
SELECT apply_tenant_rls('secoes');
SELECT apply_tenant_rls('matriculas');
SELECT apply_tenant_rls('turmas_auditoria');
SELECT apply_tenant_rls('escola_auditoria');
SELECT apply_tenant_rls('escola_configuracoes');
SELECT apply_tenant_rls('periodos_letivos');
SELECT apply_tenant_rls('frequencias');
SELECT apply_tenant_rls('lancamentos');
SELECT apply_tenant_rls('professores');
SELECT apply_tenant_rls('escola_members');
SELECT apply_tenant_rls('notas');
SELECT apply_tenant_rls('presencas');

-- =================================================================
-- Roles & Permissions (leitura para authenticated)
-- =================================================================

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.roles;
    CREATE POLICY "Allow read access to authenticated users"
      ON public.roles
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF to_regclass('public.permissions') IS NOT NULL THEN
    ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.permissions;
    CREATE POLICY "Allow read access to authenticated users"
      ON public.permissions
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- =================================================================
-- Part 3: Security Invoker para views sensíveis
-- =================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_top_cursos_media') THEN
    ALTER VIEW public.v_top_cursos_media SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_financeiro_escola_dia') THEN
    ALTER VIEW public.v_financeiro_escola_dia SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_top_turmas_hoje') THEN
    ALTER VIEW public.v_top_turmas_hoje SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_freq_por_turma_dia') THEN
    ALTER VIEW public.v_freq_por_turma_dia SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'pagamentos_status') THEN
    ALTER VIEW public.pagamentos_status SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_media_por_curso') THEN
    ALTER VIEW public.v_media_por_curso SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'escolas_view') THEN
    ALTER VIEW public.escolas_view SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'periodos') THEN
    ALTER VIEW public.periodos SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'matriculas_por_ano') THEN
    ALTER VIEW public.matriculas_por_ano SET (security_invoker = true);
  END IF;
END $$;

-- Cleanup helper
DROP FUNCTION IF EXISTS apply_tenant_rls(TEXT);

COMMIT;