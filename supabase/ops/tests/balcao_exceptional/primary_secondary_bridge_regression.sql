-- Verify the two installed writer functions using only synthetic students.
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $reserve$
DECLARE r jsonb;
BEGIN
 r:=public.preparar_aluno_para_rematricula(
   '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002');
 IF r->>'ok'<>'true' OR r->>'reservada'<>'true' THEN
   RAISE EXCEPTION 'FAIL: 6th to 7th reservation did not complete: %',r;
 END IF;
END $reserve$;
DO $finalize$
DECLARE r jsonb;
BEGIN
 r:=public.finalizar_rematricula_balcao(
   '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000002',
   '60000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001');
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'FAIL: 6th to 7th finalization failed: %',r; END IF;
 IF (SELECT count(*) FROM public.matriculas
  WHERE aluno_id='50000000-0000-4000-8000-000000000002'
    AND ano_letivo=2026 AND status='ativo' AND ativo=true
    AND origem_transicao_matricula_id='60000000-0000-4000-8000-000000000002')<>1 THEN
   RAISE EXCEPTION 'FAIL: missing unique official 7th-grade matrícula';
 END IF;
 IF (SELECT status FROM public.servico_pedidos
   WHERE id='e0000000-0000-4000-8000-000000000001')<>'granted' THEN
   RAISE EXCEPTION 'FAIL: payment order not linked to destination';
 END IF;
END $finalize$;
RESET ROLE;

-- Separate 3rd-to-5th attempt must remain invalid. It must not leave
-- a provisional target, consume a service order, or promote the student.
INSERT INTO public.classes(id,numero,nome) VALUES
 ('c0000000-0000-4000-8000-000000000003',3,'3ª classe'),
 ('c0000000-0000-4000-8000-000000000004',5,'5ª classe');
INSERT INTO public.turmas(id,escola_id,session_id,ano_letivo,status_fecho,regime,
 capacidade_maxima,classe_id,curso_id,nivel_ensino) VALUES
 ('40000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',2025,'ABERTO','{}',35,
 'c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','primario'),
 ('40000000-0000-4000-8000-000000000004',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',2026,'ABERTO','{}',35,
 'c0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','primario');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,
 status,ativo,status_fecho_origem) VALUES
 ('60000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000003',
 '40000000-0000-4000-8000-000000000003',
 '30000000-0000-4000-8000-000000000001',2025,'concluido',false,'override_admin');
INSERT INTO public.servico_pedidos VALUES
 ('e0000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000003',
 'SERV_REMATRICULA','pending_payment',NULL,'{}');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $no_skip$
BEGIN
 BEGIN
   PERFORM public.preparar_aluno_para_rematricula(
     '20000000-0000-4000-8000-000000000001',
     '50000000-0000-4000-8000-000000000003',
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000002',
     '40000000-0000-4000-8000-000000000004');
   RAISE EXCEPTION 'FAIL: 3rd-to-5th reservation bypassed school progression';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'DATA: turma destino incompatível%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.finalizar_rematricula_balcao(
     '20000000-0000-4000-8000-000000000001',
     '50000000-0000-4000-8000-000000000003',
     '60000000-0000-4000-8000-000000000003',
     '30000000-0000-4000-8000-000000000002',
     '40000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000003');
   RAISE EXCEPTION 'FAIL: 3rd-to-5th finalization bypassed school progression';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'Turma destino inválida: aluno aprovado deve seguir%' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM public.matriculas WHERE
  aluno_id='50000000-0000-4000-8000-000000000003' AND ano_letivo=2026) THEN
   RAISE EXCEPTION 'FAIL: invalid 3rd-to-5th created a target enrollment';
 END IF;
END $no_skip$;

-- A user belonging only to another school must not reserve across tenants.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $other_school$
BEGIN
 BEGIN
  PERFORM public.preparar_aluno_para_rematricula(
   '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000004');
  RAISE EXCEPTION 'FAIL: other-school operator accessed source';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'AUTH: escola_id inválido%' THEN RAISE; END IF;
 END;
END $other_school$;
RESET ROLE;
DO $rollback_check$
BEGIN
 IF (SELECT status FROM public.servico_pedidos
   WHERE id='e0000000-0000-4000-8000-000000000003')<>'pending_payment' THEN
   RAISE EXCEPTION 'FAIL: invalid progression consumed another pupil payment';
 END IF;
END $rollback_check$;
ROLLBACK;
SELECT 'PRIMARY_SECONDARY_SIX_TO_SEVEN_REGRESSION_PASS' AS result;
