-- Enable RLS on partitions for frequencias_* and lancamentos_* and add consistent policies
-- Addresses Supabase linter errors: RLS disabled on public partitions (2025-11-08)

BEGIN;

-- Safety: ensure helper functions used in policies exist before proceeding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_escola_admin' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Missing function public.is_escola_admin(uuid). Apply earlier migrations first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_escola_member' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Missing function public.is_escola_member(uuid). Apply earlier migrations first.';
  END IF;
END $$;

-- Helper to enable RLS and create unified policies on a given table
CREATE OR REPLACE FUNCTION public._ensure_unified_policies(p_tbl regclass, p_kind text)
RETURNS void AS $$
DECLARE
  v_schema text;
  v_name   text;
  v_has_escola boolean;
BEGIN
  SELECT n.nspname, c.relname INTO v_schema, v_name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_tbl;

  -- Skip if table has no escola_id column
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = v_schema AND table_name = v_name AND column_name = 'escola_id'
  ) INTO v_has_escola;
  IF NOT v_has_escola THEN
    RAISE NOTICE 'Skipping %: no escola_id column', v_name;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s.%I ENABLE ROW LEVEL SECURITY', v_schema, v_name);
  EXECUTE format('ALTER TABLE %s.%I FORCE ROW LEVEL SECURITY', v_schema, v_name);

  -- Drop any older per-table policies we might be replacing (idempotent)
  PERFORM 1 FROM pg_policies WHERE schemaname=v_schema AND tablename=v_name AND policyname IN (
    'tenant_isolation',
    'unified_select_'||p_kind,
    'unified_insert_'||p_kind,
    'unified_update_'||p_kind,
    'unified_delete_'||p_kind
  );
  IF FOUND THEN
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s.%I', v_schema, v_name);
    EXECUTE format('DROP POLICY IF EXISTS unified_select_%s ON %s.%I', p_kind, v_schema, v_name);
    EXECUTE format('DROP POLICY IF EXISTS unified_insert_%s ON %s.%I', p_kind, v_schema, v_name);
    EXECUTE format('DROP POLICY IF EXISTS unified_update_%s ON %s.%I', p_kind, v_schema, v_name);
    EXECUTE format('DROP POLICY IF EXISTS unified_delete_%s ON %s.%I', p_kind, v_schema, v_name);
  END IF;

  -- Recreate unified, role-aware policies
  EXECUTE format('CREATE POLICY unified_select_%s ON %s.%I FOR SELECT USING ((public.is_escola_admin(escola_id)) OR (public.is_escola_member(escola_id)))',
                 p_kind, v_schema, v_name);
  EXECUTE format('CREATE POLICY unified_insert_%s ON %s.%I FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id)) OR (public.is_escola_member(escola_id)))',
                 p_kind, v_schema, v_name);
  EXECUTE format('CREATE POLICY unified_update_%s ON %s.%I FOR UPDATE USING ((public.is_escola_admin(escola_id)) OR (public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id)) OR (public.is_escola_member(escola_id)))',
                 p_kind, v_schema, v_name);
  EXECUTE format('CREATE POLICY unified_delete_%s ON %s.%I FOR DELETE USING ((public.is_escola_admin(escola_id)) OR (public.is_escola_member(escola_id)))',
                 p_kind, v_schema, v_name);
END;
$$ LANGUAGE plpgsql;

-- Iterate partitions of a parent and enforce RLS + policies
CREATE OR REPLACE FUNCTION public._apply_rls_to_partitions(p_parent regclass, p_kind text)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT child.oid AS oid
    FROM pg_inherits i
    JOIN pg_class child ON child.oid = i.inhrelid
    WHERE i.inhparent = p_parent
  LOOP
    PERFORM public._ensure_unified_policies(r.oid, p_kind);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Apply to frequencias_* partitions
SELECT public._apply_rls_to_partitions('public.frequencias'::regclass, 'frequencias');

-- Apply to lancamentos_* partitions
SELECT public._apply_rls_to_partitions('public.lancamentos'::regclass, 'lancamentos');

-- Also ensure default partitions (if any) are covered when not attached
DO $$
BEGIN
  IF to_regclass('public.frequencias_default') IS NOT NULL THEN
    PERFORM public._ensure_unified_policies('public.frequencias_default'::regclass, 'frequencias');
  END IF;
  IF to_regclass('public.lancamentos_default') IS NOT NULL THEN
    PERFORM public._ensure_unified_policies('public.lancamentos_default'::regclass, 'lancamentos');
  END IF;
END $$;

-- Cleanup helper functions to keep schema tidy
DROP FUNCTION IF EXISTS public._apply_rls_to_partitions(regclass, text);
DROP FUNCTION IF EXISTS public._ensure_unified_policies(regclass, text);

-- Ask PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

