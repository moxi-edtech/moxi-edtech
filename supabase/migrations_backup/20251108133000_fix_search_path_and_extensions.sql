-- Fix function search_path and move extensions out of public (Supabase Linter)
-- Date: 2025-11-08

BEGIN;

-- 1) Ensure extensions live in the dedicated `extensions` schema
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext record;
BEGIN
  FOR ext IN
    SELECT e.extname, n.nspname AS schema_name
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname IN ('pg_trgm','btree_gin','btree_gist')
  LOOP
    IF ext.schema_name = 'public' THEN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
    END IF;
  END LOOP;
END $$;

-- 2) Set immutable search_path for sensitive/public functions
--    We set search_path to pg_temp to avoid role/session-dependent lookups.
DO $$
DECLARE
  f record;
  target_names text[] := ARRAY[
    'trg_set_escola_lancamentos',
    'trg_set_escola_avaliacoes',
    'log_audit_event',
    'current_user_role',
    'current_tenant_escola_id',
    'audit_dml_trigger',
    'check_super_admin_role',
    'dashboard',
    'create_month_partition',
    'trg_set_escola_matriculas_cursos',
    'can_access',
    'trg_set_escola_cursos_oferta',
    'set_updated_at',
    'trg_set_escola_frequencias',
    'trg_set_escola_regras_escala',
    'log_turma_auditoria',
    'trg_set_escola_rotinas',
    'trg_set_escola_sistemas_notas',
    'is_escola_member',
    'refresh_all_materialized_views',
    'log_disciplina_auditoria',
    '_each_month',
    'is_escola_admin',
    'create_month_partition_ts',
    'get_user_tenant',
    'trg_set_escola_atribuicoes_prof',
    'is_escola_diretor',
    'create_escola_with_admin',
    'log_escola_auditoria',
    'trg_set_escola_syllabi'
  ];
BEGIN
  FOR f IN
    SELECT n.nspname AS schema_name,
           p.proname  AS func_name,
           oidvectortypes(p.proargtypes) AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (target_names)
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = pg_temp',
                     f.schema_name, f.func_name, f.arg_types);
    EXCEPTION WHEN undefined_function THEN
      -- Skip if signature not found (race or dropped); continue
      NULL;
    END;
  END LOOP;
END $$;

COMMIT;

