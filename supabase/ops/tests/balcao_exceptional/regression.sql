BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

-- The previous school year stays closed. The academic secretary may enter
-- one real grade with a reason; the old student's enrollment remains pending.
DO $grade$
DECLARE r jsonb;
BEGIN
 r := public.lancar_nota_historica_individual(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  1,'MAC',12.5,'Registo retroativo com pauta de avaliação verificada.');
 IF r->>'ok'<>'true' OR r->>'historico'<>'true' THEN
  RAISE EXCEPTION 'FAIL: historical grade was not saved: %',r;
 END IF;
 IF (SELECT count(*) FROM public.notas WHERE valor=12.5)<>1 THEN
  RAISE EXCEPTION 'FAIL: actual grade was not persisted';
 END IF;
 IF (SELECT ativo FROM public.anos_letivos WHERE ano=2025) THEN
  RAISE EXCEPTION 'FAIL: closed academic year reopened globally';
 END IF;
  IF public.can_write_historical_grade(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'FAIL: grade writer remains unlocked';
 END IF;
END $grade$;

-- An academic secretary must be able to finish the remaining assessments
-- after the first note, without reopening the school year or issuing another
-- documentary decision.
SELECT public.lancar_nota_historica_individual(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  1,'NPP',14.0,'Segunda avaliação real lançada na mesma origem encerrada.');

DO $second_grade$
BEGIN
 IF (SELECT count(*) FROM public.notas)=2 THEN RETURN; END IF;
 RAISE EXCEPTION 'FAIL: second real historical grade was blocked';
END $second_grade$;

-- Failed range validation rolls back the whole write (grade and journal).
DO $invalid_grade$
BEGIN
 BEGIN
  PERFORM public.lancar_nota_historica_individual(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '80000000-0000-4000-8000-000000000001',
   1,'NPT',30,'Nota fora da escala; nenhum lançamento permitido.');
  RAISE EXCEPTION 'FAIL: invalid grade 30 accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.notas)<>2 THEN
  RAISE EXCEPTION 'FAIL: invalid grade produced a write';
 END IF;
END $invalid_grade$;

-- The closed renewal window may be overridden for exactly one student,
-- target year and authorized operator, with an immutable audit.
DO $late$
DECLARE r jsonb;
BEGIN
 r := public.autorizar_rematricula_fora_prazo(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'Confirmação excepcional deste aluno após encerramento das inscrições.'
 );
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'FAIL: late authorization failed'; END IF;
 IF NOT public.tem_autorizacao_rematricula_fora_prazo(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
 ) THEN RAISE EXCEPTION 'FAIL: authorization not visible to its owner'; END IF;
 IF (SELECT data_fim FROM public.rematricula_janelas LIMIT 1)>=now() THEN
  RAISE EXCEPTION 'FAIL: global renewal window was changed';
 END IF;
END $late$;

-- Another actor from the same school cannot steal the one-student permission,
-- and a financial role cannot edit the academic grade.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $finance$
BEGIN
 IF public.tem_autorizacao_rematricula_fora_prazo(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
 ) THEN RAISE EXCEPTION 'FAIL: permission leaked to another operator'; END IF;
 BEGIN
  PERFORM public.lancar_nota_historica_individual(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '80000000-0000-4000-8000-000000000001',
   1,'MAC',19,'Tentativa não autorizada de alterar nota antiga.');
  RAISE EXCEPTION 'FAIL: financial alias wrote historical grade';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $finance$;

-- A foreign-school director has no access to this student's grades/window.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $foreign$
BEGIN
 BEGIN
  PERFORM public.autorizar_rematricula_fora_prazo(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   'Tentativa de operador pertencente a outra escola.');
  RAISE EXCEPTION 'FAIL: cross-school late enrollment authorized';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $foreign$;

RESET ROLE;
DO $audit$
BEGIN
 IF (SELECT count(*) FROM public.audit_logs
   WHERE action='BALCAO_NOTA_HISTORICA_LANCADA'
    AND details->>'motivo' IS NOT NULL)<>2 THEN
  RAISE EXCEPTION 'FAIL: real grade has no atomic reason/actor audit';
 END IF;
 IF (SELECT count(*) FROM public.audit_logs
   WHERE action='BALCAO_REMATRICULA_FORA_PRAZO_AUTORIZADA'
    AND details->>'motivo' IS NOT NULL)<>1 THEN
  RAISE EXCEPTION 'FAIL: late enrollment has no reason/actor audit';
 END IF;
END $audit$;
ROLLBACK;
SELECT 'BALCAO_EXCEPTIONAL_GRADES_AND_LATE_WINDOW_PASS' AS result;
