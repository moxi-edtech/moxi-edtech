-- Synthetic only. Must run after supabase/ops/tests/balcao_exceptional/fixture.sql.
-- Extends the minimal fixture with the history status used by the request RPC.
ALTER TABLE public.historico_anos ADD COLUMN IF NOT EXISTS snapshot_status text;
GRANT SELECT ON public.escola_users TO authenticated;
\ir ../../../migrations/20271109040000_balcao_historic_recovery_requests.sql

BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);

-- Finance may REQUEST academic action, but never decide approval or write grades.
DO $finance_request$
DECLARE first_result jsonb;
DECLARE second_result jsonb;
BEGIN
 first_result := public.solicitar_regularizacao_historica_balcao(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'Pauta de 2025 pendente de regularização individual.');
 second_result := public.solicitar_regularizacao_historica_balcao(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  'Segundo clique não deve gerar outra solicitação.');
 IF first_result->>'ok'<>'true' OR first_result->>'criado'<>'true'
  OR second_result->>'criado'<>'false'
  OR first_result->>'pedido_id' IS DISTINCT FROM second_result->>'pedido_id' THEN
    RAISE EXCEPTION 'FAIL: finance role cannot create one idempotent request';
 END IF;
 IF (SELECT count(*) FROM public.balcao_historic_recovery_requests)<>1 THEN
   RAISE EXCEPTION 'FAIL: duplicate request for same student';
 END IF;
 IF (SELECT count(*) FROM public.notas)<>0 THEN
   RAISE EXCEPTION 'FAIL: request fabricated grades';
 END IF;
 IF has_function_privilege('anon','public.solicitar_regularizacao_historica_balcao(uuid,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: anonymous can request';
 END IF;
 IF has_table_privilege('authenticated','public.balcao_historic_recovery_requests','INSERT') THEN
   RAISE EXCEPTION 'FAIL: callers can bypass audited writer';
 END IF;
END $finance_request$;

-- Foreign-school user cannot see another school's request or call writer.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $tenant$
BEGIN
 IF (SELECT count(*) FROM public.balcao_historic_recovery_requests)<>0 THEN
   RAISE EXCEPTION 'FAIL: student request leaked across schools';
 END IF;
 BEGIN
   PERFORM public.solicitar_regularizacao_historica_balcao(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'Tentativa de solicitação para escola diferente.');
   RAISE EXCEPTION 'FAIL: cross-school request accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $tenant$;

-- Secretary sees the existing request and may enter grades via separate,
-- already-tested RPC; this request alone never grants that permission.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $secretary$
BEGIN
 IF (SELECT count(*) FROM public.balcao_historic_recovery_requests)<>1 THEN
  RAISE EXCEPTION 'FAIL: secretary cannot see school request';
 END IF;
 BEGIN
  PERFORM public.solicitar_regularizacao_historica_balcao(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    'Matrícula já fechada sem histórico em aberto.');
  RAISE EXCEPTION 'FAIL: invalid source accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $secretary$;
RESET ROLE;
DO $audit$
BEGIN
 IF (SELECT count(*) FROM public.audit_logs
     WHERE action='BALCAO_REGULARIZACAO_ACADEMICA_SOLICITADA')<>1 THEN
   RAISE EXCEPTION 'FAIL: missing or duplicated audit';
 END IF;
END $audit$;
ROLLBACK;
SELECT 'BALCAO_HISTORIC_REQUEST_ACTIONABILITY_PASS' AS result;
