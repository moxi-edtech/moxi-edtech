-- AUT-001/002: all test records are synthetic; use only the disposable
-- `klasse_transfer_test` database bootstrapped by the verify script.
SET test.school = '00000000-0000-4000-8000-000000000001';
SET test.actor = '00000000-0000-4000-8000-000000000031';
SET statement_timeout = '45s';

CREATE OR REPLACE FUNCTION pg_temp.expect_secondary_p1050(
  p_enrollment uuid DEFAULT '00000000-0000-4000-8000-000000000021',
  p_source uuid DEFAULT '00000000-0000-4000-8000-000000000011',
  p_target uuid DEFAULT '00000000-0000-4000-8000-000000000012'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_evidence jsonb;
BEGIN
  SELECT public.turma_transfer_academic_evidence_v1(p_enrollment)
    INTO v_evidence;
  IF (v_evidence->>'has_evidence') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Preflight advertised transfer despite academic evidence';
  END IF;
  PERFORM public.transferir_aluno_turma(
    p_enrollment, p_target, 'Conciliação documental pendente em teste'
  );
  RAISE EXCEPTION 'Transferência individual inesperadamente permitida';
EXCEPTION
  WHEN SQLSTATE 'P1050' THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_secondary_bulk_p1050()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.transferir_turma_em_lote(
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000006',
    'Conciliação documental pendente em lote'
  );
  RAISE EXCEPTION 'Transferência em lote inesperadamente permitida';
EXCEPTION
  WHEN SQLSTATE 'P1050' THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_unchanged()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM public.matriculas
      WHERE turma_id='00000000-0000-4000-8000-000000000011' AND ativo) <> 2
    OR (SELECT count(*) FROM public.matriculas
      WHERE turma_id='00000000-0000-4000-8000-000000000012' AND ativo) <> 0
    OR (SELECT count(*) FROM public.audit_logs WHERE action='MATRICULA_TRANSFERIDA') <> 0
  THEN
    RAISE EXCEPTION 'Registos, capacidade ou auditoria mudaram após P1050';
  END IF;
END $$;

-- The preflight is an authenticated, tenant-authorized boolean, never a
-- general purpose student-history lookup.
SET ROLE authenticated;
DO $smoke$
DECLARE v jsonb;
BEGIN
  v := public.turma_transfer_academic_evidence_v1(
    '00000000-0000-4000-8000-000000000021');
  IF v->>'has_evidence' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Preflight should permit a history-free transfer';
  END IF;
END $smoke$;
RESET ROLE;
SET test.actor='00000000-0000-4000-8000-000000000033';
SET ROLE authenticated;
DO $deny$
BEGIN
  PERFORM public.turma_transfer_academic_evidence_v1(
    '00000000-0000-4000-8000-000000000021');
  RAISE EXCEPTION 'Unexpected unauthorized academic disclosure';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $deny$;
RESET ROLE;
SET test.actor='00000000-0000-4000-8000-000000000031';

-- Row-bound secondary evidence: the single RPC, batch RPC and plain UPDATE
-- all must fail before any enrollment, grade, receipt or audit mutation.
BEGIN;
INSERT INTO public.notas_avaliacoes VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000101',NULL);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.lancamentos VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.historico_snapshot_locks VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.historico_anos VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000011',2026);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

-- Legacy historical snapshot with an absent matricula_id is still attached
-- to the correct school, student, class and year; it cannot be forgotten.
BEGIN;
INSERT INTO public.historico_anos VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  NULL,'00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000011',2026);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.reapreciacao_pedidos VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.raa_indisciplina_eventos VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.aluno_falta_justificacoes VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000021');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

-- Artifacts attached to the *source class* must block even when a pupil
-- has no notes yet. Signed PDF and unsent batch are equally historical.
BEGIN;
INSERT INTO public.pautas_oficiais VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.pautas_lote_jobs VALUES(
  '00000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000001');
INSERT INTO public.pautas_lote_itens VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000011');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.excecoes_pauta VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

BEGIN;
INSERT INTO public.presencas_deprecated VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000011');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_secondary_p1050();
SELECT pg_temp.expect_secondary_bulk_p1050();
RESET ROLE;
SELECT pg_temp.assert_unchanged();
ROLLBACK;

-- A third-party tenant's evidence must never be a false match. The school
-- and enrollment identifiers are part of every secondary history predicate.
BEGIN;
INSERT INTO public.pautas_oficiais VALUES(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000014');
SET LOCAL ROLE authenticated;
SELECT public.transferir_aluno_turma(
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000012',
  'Correção de turma sem evidências na matrícula da escola');
RESET ROLE;
ROLLBACK;
SELECT pg_temp.assert_unchanged();

-- Re-applying the secondary guard must retain its grants and never open
-- a PUBLIC/anon executable SECURITY DEFINER entrypoint.
DO $$
BEGIN
  IF has_function_privilege('anon',
       'public.turma_transfer_academic_evidence_v1(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated',
       'public.turma_transfer_academic_evidence_v1(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated',
       'public.turma_transfer_has_secondary_evidence_v1(uuid,uuid,uuid,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY: preflight RPC or helper has incorrect grants';
  END IF;
  IF has_function_privilege('anon',
       'public.guard_turma_transfer_secondary_evidence_v1()', 'EXECUTE')
    OR has_function_privilege('authenticated',
       'public.guard_turma_transfer_secondary_evidence_v1()', 'EXECUTE')
    OR has_function_privilege('anon',
       'public.lock_turma_for_academic_artifact_v1()', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY: a trigger helper is callable directly';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.matriculas'::regclass
      AND t.tgname='trg_guard_turma_transfer_secondary_evidence'
      AND t.tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'Secondary academic guard not installed';
  END IF;
END $$;
