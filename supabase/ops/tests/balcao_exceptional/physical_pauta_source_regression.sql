BEGIN;
-- The school secretary corrects an incorrectly assigned 2025 turma, no
-- attachment or approval request, prior to entering physical pauta marks.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $success$
DECLARE r jsonb;
BEGIN
 r:=public.balcao_corrigir_turma_origem_pauta(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000004');
 IF r->>'ok'<>'true' OR r->>'alterada'<>'true' THEN
   RAISE EXCEPTION 'FAIL: physical pauta turma change was not saved: %',r;
 END IF;
 IF (SELECT turma_id FROM public.matriculas
   WHERE id='60000000-0000-4000-8000-000000000003') <>
      '40000000-0000-4000-8000-000000000004'::uuid THEN
    RAISE EXCEPTION 'FAIL: selected pupil still belongs to the wrong class';
 END IF;
 IF (SELECT count(*) FROM public.matriculas
   WHERE aluno_id='50000000-0000-4000-8000-000000000003')<>1 THEN
    RAISE EXCEPTION 'FAIL: duplicate enrollment produced';
 END IF;
END $success$;
DO $idempotent$
DECLARE r jsonb;
BEGIN
 r:=public.balcao_corrigir_turma_origem_pauta(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000004');
 IF r->>'alterada'<>'false' THEN RAISE EXCEPTION 'FAIL: identical retry was not idempotent'; END IF;
END $idempotent$;
RESET ROLE;
DO $audit$
BEGIN
 IF (SELECT count(*) FROM public.audit_logs WHERE
   action='BALCAO_PAUTA_TURMA_ORIGEM_CORRIGIDA' AND
   entity_id='60000000-0000-4000-8000-000000000003' AND
   actor_id='10000000-0000-4000-8000-000000000001' AND
   before->>'turma_id'='40000000-0000-4000-8000-000000000003' AND
   after->>'turma_id'='40000000-0000-4000-8000-000000000004')<>1 THEN
   RAISE EXCEPTION 'FAIL: before/after automatic audit missing';
 END IF;
 IF EXISTS(SELECT 1 FROM public.balcao_pauta_turma_correction_nonce) THEN
   RAISE EXCEPTION 'FAIL: trusted correction nonce persisted after save';
 END IF;
END $audit$;

-- Once the selected source grade exists, a class correction must not move it
-- to another turma and silently relabel a physical grade from the old class.
-- This fixture does not load full turma + avaliação period records; only
-- simulate an already-existing grade for the source-class immutability check.
-- The real historical grade writer and its normal guards are tested separately.
ALTER TABLE public.notas DISABLE TRIGGER USER;
INSERT INTO public.notas(escola_id,matricula_id,avaliacao_id,valor)
VALUES(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000003',
 'c0000000-0000-4000-8000-000000000005',
 15
);
ALTER TABLE public.notas ENABLE TRIGGER USER;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $no_relabel$
BEGIN
 BEGIN
   PERFORM public.balcao_corrigir_turma_origem_pauta(
     '20000000-0000-4000-8000-000000000001',
     '60000000-0000-4000-8000-000000000003',
     '40000000-0000-4000-8000-000000000003');
   RAISE EXCEPTION 'FAIL: existing pupil note was relabelled to another turma';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $no_relabel$;

-- No one from another tenant can change the selected pupil's legacy class.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $foreign$
BEGIN
 BEGIN
  PERFORM public.balcao_corrigir_turma_origem_pauta(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'FAIL: other-school operator changed source class';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $foreign$;
RESET ROLE;
ROLLBACK;
SELECT 'PHYSICAL_PAUTA_SOURCE_CORRECTION_PASS' AS result;
