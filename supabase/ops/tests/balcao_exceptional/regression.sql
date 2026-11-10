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

-- Even an unlinked legal history for the same student and year must deny
-- late grade edits. Historical correction never alters published results.
RESET ROLE;
INSERT INTO public.historico_anos(id,escola_id,matricula_id,aluno_id,ano_letivo,resultado_final)
VALUES('f0000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001',NULL,
 '50000000-0000-4000-8000-000000000001',2025,'aprovado');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $legal_history_lock$
BEGIN
 BEGIN
  PERFORM public.lancar_nota_historica_individual(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '80000000-0000-4000-8000-000000000001',
   1,'NPT',16.0,'Não alterar notas após publicação do histórico legal.');
  RAISE EXCEPTION 'FAIL: unlinked legal history ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $legal_history_lock$;
RESET ROLE;
DELETE FROM public.historico_anos WHERE id='f0000000-0000-4000-8000-000000000001';
INSERT INTO public.historico_snapshot_locks(escola_id,matricula_id,ano_letivo_id,status)
VALUES('20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','fechado');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $snapshot_lock$
BEGIN
 BEGIN
  PERFORM public.lancar_nota_historica_individual(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   '80000000-0000-4000-8000-000000000001',
   1,'NPT',16.0,'Não alterar notas com fecho de snapshot legal.');
  RAISE EXCEPTION 'FAIL: legal snapshot lock ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $snapshot_lock$;
RESET ROLE;
DELETE FROM public.historico_snapshot_locks;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

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

-- End-to-end: a closed-window renewal is committed by the production
-- function without prior authorization.
DO $late_real_writer$
DECLARE result jsonb;
BEGIN
 result := public.finalizar_rematricula_balcao(
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000001'
 );
 IF result->>'ok'<>'true' THEN
  RAISE EXCEPTION 'FAIL: late finalization not completed: %',result;
 END IF;
 IF (SELECT count(*) FROM public.matriculas
   WHERE aluno_id='50000000-0000-4000-8000-000000000002'
     AND ano_letivo=2026 AND status='ativo' AND ativo=true)<>1 THEN
  RAISE EXCEPTION 'FAIL: destination enrollment not activated';
 END IF;
 IF (SELECT status FROM public.servico_pedidos
    WHERE id='e0000000-0000-4000-8000-000000000001')<>'granted' THEN
  RAISE EXCEPTION 'FAIL: renewal order not granted';
 END IF;
 IF public.tem_autorizacao_rematricula_fora_prazo(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002'
 ) THEN
  RAISE EXCEPTION 'FAIL: one-time permit not consumed';
 END IF;
END $late_real_writer$;

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
 IF (SELECT count(*) FROM public.audit_logs
   WHERE action='BALCAO_REMATRICULA_FORA_PRAZO_CONCLUIDA'
     AND details->>'matricula_destino_id' IS NOT NULL
     AND details->>'modo'='direta')<>1 THEN
  RAISE EXCEPTION 'FAIL: completed late enrollment missing atomic audit';
 END IF;
END $audit$;
ROLLBACK;
SELECT 'BALCAO_EXCEPTIONAL_GRADES_AND_LATE_WINDOW_PASS' AS result;
