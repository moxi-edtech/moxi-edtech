\set ON_ERROR_STOP on
-- Reuse the exact verified phase-A fixture (including strict RLS, 55
-- fictional pupils, enrollment-year / settlement edge cases).
\ir regression_command_center_finance_scope.sql
RESET ROLE;
\ir ../../migrations/20271022135000_command_center_combined_filters.sql
TRUNCATE public.public_rate_limits;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE
  item record; n integer;
  first_id uuid;
  total integer;
  denied boolean := false;
BEGIN
  -- Exactly ONE pupil has both independent confirmed signals.
  SELECT count(*),max(aluno_id),max(total_filtrado)::integer
  INTO n,first_id,total
  FROM public.command_center_roster_operational_v1(
     p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
     p_ano_letivo=>2026,
     p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
     p_filter=>'ambos', p_limit=>20
  ) WHERE NOT rate_limited;
  IF n<>1 OR total<>1 OR first_id<>'00000000-0000-4000-8100-000000000004' THEN
    RAISE EXCEPTION 'Combined filter returned unsupported result %/%/%',n,total,first_id;
  END IF;
  -- Combining filter with text search cannot leak unrelated pupils.
  SELECT count(*) INTO n FROM public.command_center_roster_operational_v1(
     p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
     p_ano_letivo=>2026,
     p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
     p_query=>'aluno de teste 04', p_filter=>'ambos');
  IF n<>1 THEN RAISE EXCEPTION 'Combined query filter mismatch'; END IF;
  BEGIN
    PERFORM * FROM public.command_center_roster_operational_v1(
      p_escola_id=>'00000000-0000-4000-8000-0000000000b2',
      p_ano_letivo=>2026,
      p_turma_id=>'00000000-0000-4000-8000-0000000000f2',
      p_filter=>'ambos');
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Combined filter exposed cross-school records'; END IF;
  BEGIN
    PERFORM * FROM public.command_center_roster_operational_v1(
      p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
      p_ano_letivo=>2026,
      p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
      p_filter=>'ambos',p_query=>''' OR TRUE; DROP TABLE public.alunos; --');
  EXCEPTION WHEN syntax_error OR invalid_parameter_value THEN
    -- Bad search input is a safe SQL parser error, not SQL execution.
    NULL;
  END;
  IF to_regclass('public.alunos') IS NULL THEN
    RAISE EXCEPTION 'Hostile search modified the pupils table';
  END IF;
END; $$;
RESET ROLE;
\ir ../../migrations/20271022135000_command_center_combined_filters.sql
-- Idempotent reapplication of the v1 signature does not create overloads.
SELECT count(*) AS combined_function_overloads FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname='command_center_roster_operational_v1';
