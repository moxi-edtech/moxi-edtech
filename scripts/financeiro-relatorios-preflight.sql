-- Preflight de read models do Financeiro (produção)
-- Objetivo: evitar 500 por erro de schema em /api/financeiro/relatorios/*

WITH required_objects AS (
  SELECT 'view'::text AS kind, 'public'::text AS schema_name, 'vw_financeiro_propinas_mensal_escola'::text AS object_name
  UNION ALL SELECT 'view', 'public', 'vw_financeiro_propinas_por_turma'
  UNION ALL SELECT 'view', 'public', 'vw_financeiro_escola_dia'
  UNION ALL SELECT 'view', 'public', 'vw_pagamentos_status'
  UNION ALL SELECT 'matview', 'internal', 'mv_financeiro_propinas_mensal_escola'
  UNION ALL SELECT 'matview', 'internal', 'mv_financeiro_propinas_por_turma'
  UNION ALL SELECT 'matview', 'internal', 'mv_pagamentos_status'
  UNION ALL SELECT 'matview', 'public', 'mv_financeiro_escola_dia'
),
exists_check AS (
  SELECT
    ro.kind,
    ro.schema_name,
    ro.object_name,
    CASE
      WHEN ro.kind = 'view' THEN EXISTS (
        SELECT 1 FROM pg_views v
        WHERE v.schemaname = ro.schema_name AND v.viewname = ro.object_name
      )
      WHEN ro.kind = 'matview' THEN EXISTS (
        SELECT 1 FROM pg_matviews mv
        WHERE mv.schemaname = ro.schema_name AND mv.matviewname = ro.object_name
      )
      ELSE FALSE
    END AS exists_ok
  FROM required_objects ro
),
invoker_check AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS view_name,
    COALESCE(c.reloptions, ARRAY[]::text[]) AS reloptions,
    COALESCE('security_invoker=true' = ANY(c.reloptions), FALSE) AS security_invoker_ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v'
    AND n.nspname = 'public'
    AND c.relname IN (
      'vw_financeiro_propinas_mensal_escola',
      'vw_financeiro_propinas_por_turma',
      'vw_financeiro_escola_dia',
      'vw_pagamentos_status'
    )
),
grant_check AS (
  SELECT
    table_schema AS schema_name,
    table_name AS view_name,
    bool_or(grantee = 'authenticated' AND privilege_type = 'SELECT') AS auth_select_ok
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'vw_financeiro_propinas_mensal_escola',
      'vw_financeiro_propinas_por_turma',
      'vw_financeiro_escola_dia',
      'vw_pagamentos_status'
    )
  GROUP BY table_schema, table_name
),
refresh_check AS (
  SELECT
    p.proname,
    TRUE AS exists_ok
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'refresh_mv_financeiro_propinas_mensal_escola',
      'refresh_mv_financeiro_propinas_por_turma',
      'refresh_mv_pagamentos_status'
    )
)
SELECT
  'object_exists' AS check_type,
  kind,
  schema_name,
  object_name,
  exists_ok::text AS status
FROM exists_check
UNION ALL
SELECT
  'security_invoker' AS check_type,
  'view' AS kind,
  schema_name,
  view_name AS object_name,
  security_invoker_ok::text AS status
FROM invoker_check
UNION ALL
SELECT
  'grant_authenticated_select' AS check_type,
  'view' AS kind,
  schema_name,
  view_name AS object_name,
  COALESCE(auth_select_ok, FALSE)::text AS status
FROM grant_check
UNION ALL
SELECT
  'refresh_function_exists' AS check_type,
  'function' AS kind,
  'public' AS schema_name,
  proname AS object_name,
  exists_ok::text AS status
FROM refresh_check
ORDER BY check_type, object_name;

-- Gate duro (descomente para CI / bloqueio de deploy)
-- DO $$
-- DECLARE
--   missing_count int;
-- BEGIN
--   SELECT COUNT(*) INTO missing_count
--   FROM (
--     SELECT 1
--     FROM (
--       SELECT exists_ok AS ok FROM exists_check
--       UNION ALL
--       SELECT security_invoker_ok AS ok FROM invoker_check
--       UNION ALL
--       SELECT COALESCE(auth_select_ok, FALSE) AS ok FROM grant_check
--     ) t
--     WHERE NOT t.ok
--   ) q;
--
--   IF missing_count > 0 THEN
--     RAISE EXCEPTION 'Financeiro read-model preflight FAILED: % checks não conformes', missing_count;
--   END IF;
-- END $$;
