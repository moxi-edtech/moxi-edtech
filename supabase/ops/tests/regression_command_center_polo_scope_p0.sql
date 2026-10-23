\set ON_ERROR_STOP on
-- PostgreSQL 17 only; synthetic sources, not a production connection.
\ir command_center_load_seed.sql
RESET ROLE;
\ir ../../migrations/20271022141000_command_center_schoolwide_polo_barrier.sql

-- Default existing fixture user is Secretaria and must fail with NO polo param.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE denied boolean := false;
BEGIN
 BEGIN
   PERFORM * FROM public.command_center_roster_operational_v1(
     p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
     p_ano_letivo=>2026,
     p_turma_id=>'00000000-0000-4000-8000-0000000000f1');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: Secretaria used absent polo as wildcard'; END IF;
END; $$;
RESET ROLE;
-- Trusted current papel, not legacy role, controls institutional grant.
UPDATE public.escola_users
SET papel='admin',role='staff'
WHERE user_id='00000000-0000-4000-8000-0000000000d1'
 AND escola_id='00000000-0000-4000-8000-0000000000a1';

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE n integer; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.command_center_roster_operational_v1(
  p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
  p_ano_letivo=>2026,
  p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
  p_limit=>5);
 IF n=0 THEN RAISE EXCEPTION 'FAIL: institutional admin denied same school'; END IF;

 denied:=false;
 BEGIN
  PERFORM * FROM public.command_center_roster_operational_v1(
    p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
    p_ano_letivo=>2026,
    p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
    p_polo_id=>'00000000-0000-4000-8000-0000000000aa');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: explicit polo accepted without canonical relation'; END IF;

 denied:=false;
 BEGIN
  PERFORM * FROM public.command_center_roster_operational_v1(
   p_escola_id=>'00000000-0000-4000-8000-0000000000b2',
   p_ano_letivo=>2026,
   p_turma_id=>'00000000-0000-4000-8000-0000000000f2');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: admin read school B'; END IF;
END; $$;
RESET ROLE;
-- Altering the legacy `role` column cannot grant wider access.
UPDATE public.escola_users SET papel='secretaria', role='admin_escola'
WHERE user_id='00000000-0000-4000-8000-0000000000d1'
 AND escola_id='00000000-0000-4000-8000-0000000000a1';
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  PERFORM * FROM public.command_center_roster_operational_v1(
   p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
   p_ano_letivo=>2026,
   p_turma_id=>'00000000-0000-4000-8000-0000000000f1');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: legacy role column bypassed canonical papel'; END IF;
END; $$;
RESET ROLE;
DO $$
BEGIN
 IF has_function_privilege('authenticated',
  'public.command_center_roster_keyset(uuid,integer,uuid,uuid,text,text,uuid,integer,uuid)','EXECUTE')
  OR has_function_privilege('authenticated',
  'public.command_center_roster_keyset_v2(uuid,integer,uuid,uuid,text,text,uuid,integer,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: legacy roster RPC bypass still executable'; END IF;
END; $$;
SELECT 'CC-003 disposable RPC gate verified' AS result;
