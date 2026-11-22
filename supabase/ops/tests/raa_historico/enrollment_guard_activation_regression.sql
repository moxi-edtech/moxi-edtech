-- Disposable PG17 only. The RAA RPC here is deliberately stubbed; this tests
-- the activation trigger, NOT end-to-end real RAA / RLS / payment semantics.
BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001',true);
CREATE FUNCTION public.fixture_expect_activation(
 p_student uuid, p_dest uuid, p_origin uuid, p_expected text,
 p_status text DEFAULT 'ativo', p_requested_escola uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $test$
DECLARE v_target record; v_error text; v_new_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO v_target FROM public.turmas WHERE id=p_dest;
 IF v_target.id IS NULL THEN RAISE EXCEPTION 'fixture target missing'; END IF;
 BEGIN
  INSERT INTO public.matriculas
   (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,origem_transicao_matricula_id)
  VALUES
   (v_new_id,coalesce(p_requested_escola,v_target.escola_id),p_student,
    p_dest,v_target.session_id,v_target.ano_letivo,p_status,p_status='ativo',p_origin);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
 END;
 IF p_expected='OK' AND v_error IS NOT NULL THEN
  RAISE EXCEPTION 'unexpected rejection expected OK: %', v_error;
 ELSIF p_expected<>'OK' AND v_error IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'expected %, received %', p_expected,coalesce(v_error,'SUCCESS');
 END IF;
 RETURN v_new_id;
END;
$test$;
GRANT EXECUTE ON FUNCTION public.fixture_expect_activation(uuid,uuid,uuid,text,text,uuid) TO authenticated;
GRANT SELECT ON public.turmas TO authenticated;
SET ROLE authenticated;
DO $cases$
DECLARE
 s uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 c uuid:=gen_random_uuid(); c_next uuid:=gen_random_uuid();
 y25 uuid:=gen_random_uuid(); y26 uuid:=gen_random_uuid(); y27 uuid:=gen_random_uuid();
 t3_25 uuid:=gen_random_uuid(); t3_26 uuid:=gen_random_uuid();
 t4_26 uuid:=gen_random_uuid(); t4_26b uuid:=gen_random_uuid();
 t6_25 uuid:=gen_random_uuid(); t7_26 uuid:=gen_random_uuid();
 t9_25 uuid:=gen_random_uuid(); t9_26 uuid:=gen_random_uuid();
 t10_26 uuid:=gen_random_uuid(); t0_25 uuid:=gen_random_uuid();
 t1_26 uuid:=gen_random_uuid(); t4_27 uuid:=gen_random_uuid();
 t_missing_26 uuid:=gen_random_uuid(); t_b_25 uuid:=gen_random_uuid();
 class3 uuid:=gen_random_uuid(); class4 uuid:=gen_random_uuid();
 o_pass uuid:=gen_random_uuid(); o_retain uuid:=gen_random_uuid();
 o_final uuid:=gen_random_uuid(); o_pre uuid:=gen_random_uuid();
 o_cond uuid:=gen_random_uuid(); o_pending uuid:=gen_random_uuid();
 o_blocked uuid:=gen_random_uuid(); o_unknown uuid:=gen_random_uuid();
 o_wrongyear uuid:=gen_random_uuid(); o_other uuid:=gen_random_uuid();
 v_active uuid; v_code text; v_blocked boolean:=false;
BEGIN
 PERFORM set_config('fixture.tenant_id',s::text,true);
 INSERT INTO public.turmas(id,escola_id,curso_id,classe_id,ano_letivo,session_id,classe_num)
 VALUES
 (t3_25,s,c,class3,2025,y25,3),(t3_26,s,c,class3,2026,y26,3),
 (t4_26,s,c,class4,2026,y26,4),(t4_26b,s,c,class4,2026,y26,4),
 (t6_25,s,c,gen_random_uuid(),2025,y25,6),(t7_26,s,c,gen_random_uuid(),2026,y26,7),
 (t9_25,s,c,gen_random_uuid(),2025,y25,9),(t9_26,s,c,gen_random_uuid(),2026,y26,9),
 (t10_26,s,c_next,gen_random_uuid(),2026,y26,10),
 (t0_25,s,c,gen_random_uuid(),2025,y25,0),(t1_26,s,c,gen_random_uuid(),2026,y26,1),
 (t4_27,s,c,class4,2027,y27,4),
 (t_missing_26,s,c,gen_random_uuid(),2026,y26,NULL),
 (t_b_25,b,c,class3,2025,y25,3);
 INSERT INTO public.matriculas
  (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo)
 VALUES
 (o_pass,s,o_pass,t3_25,y25,2025,'concluido',false),
 (o_retain,s,o_retain,t3_25,y25,2025,'concluido',false),
 (o_final,s,o_final,t9_25,y25,2025,'concluido',false),
 (o_pre,s,o_pre,t0_25,y25,2025,'concluido',false),
 (o_cond,s,o_cond,t6_25,y25,2025,'concluido',false),
 (o_pending,s,o_pending,t3_25,y25,2025,'concluido',false),
 (o_blocked,s,o_blocked,t3_25,y25,2025,'concluido',false),
 (o_unknown,s,o_unknown,t3_25,y25,2025,'concluido',false),
 (o_wrongyear,s,o_wrongyear,t3_25,y25,2025,'concluido',false),
 (o_other,b,o_pass,t_b_25,y25,2025,'concluido',false);
 INSERT INTO public.fixture_raa_decision(escola_id,matricula_id,resultado)
 VALUES
 (s,o_pass,'{"decision":"transitou","destino":"proxima_etapa"}'),
 (s,o_retain,'{"decision":"retido","destino":"mesma_etapa"}'),
 (s,o_final,'{"decision":"concluiu","destino":"conclusao"}'),
 (s,o_pre,'{"decision":"transitou","destino":"proxima_etapa"}'),
 (s,o_cond,'{"decision":"inscricao_condicional","destino":"proxima_etapa"}'),
 (s,o_pending,'{"decision":"pendente","destino":"aguardar_dados"}'),
 (s,o_blocked,'{"decision":"transitou","destino":"proxima_etapa","efetivacao_matricula_bloqueada":true}'),
 (s,o_unknown,'{"decision":"recurso","destino":"aguardar_dados"}'),
 (s,o_wrongyear,'{"decision":"transitou","destino":"proxima_etapa"}');
 IF has_function_privilege('anon','public.guard_enrollment_raa_progression_v1()','EXECUTE')
    OR has_function_privilege('authenticated','public.guard_enrollment_raa_progression_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'TRIGGER_FUNCTION_EXPOSED'; END IF;
 PERFORM public.fixture_expect_activation(o_pass,t4_26,o_pass,'OK');
 PERFORM public.fixture_expect_activation(o_pass,t3_26,o_pass,'ENROLLMENT_RAA_DESTINATION_MISMATCH');
 PERFORM public.fixture_expect_activation(o_retain,t3_26,o_retain,'OK');
 PERFORM public.fixture_expect_activation(o_retain,t4_26,o_retain,'ENROLLMENT_RAA_DESTINATION_MISMATCH');
 PERFORM public.fixture_expect_activation(o_final,t9_26,o_final,'ENROLLMENT_RAA_DESTINATION_MISMATCH');
 PERFORM public.fixture_expect_activation(o_final,t10_26,o_final,'OK');
 PERFORM public.fixture_expect_activation(o_pre,t1_26,o_pre,'OK');
 PERFORM public.fixture_expect_activation(o_cond,t7_26,o_cond,'OK');
 PERFORM public.fixture_expect_activation(o_pending,t4_26,o_pending,'ENROLLMENT_RAA_DECISION_REQUIRED');
 PERFORM public.fixture_expect_activation(o_unknown,t4_26,o_unknown,'ENROLLMENT_RAA_DECISION_REQUIRED');
 PERFORM public.fixture_expect_activation(o_blocked,t4_26,o_blocked,'ENROLLMENT_RAA_CONFIRMATION_BLOCKED');
 PERFORM public.fixture_expect_activation(o_pass,t_missing_26,o_pass,'ENROLLMENT_RAA_GRADE_UNRESOLVED');
 PERFORM public.fixture_expect_activation(o_wrongyear,t4_27,o_wrongyear,'ENROLLMENT_TRANSITION_YEAR_INVALID');
 PERFORM public.fixture_expect_activation(o_pass,t4_26,o_other,'ENROLLMENT_TRANSITION_ORIGIN_INVALID');
 PERFORM public.fixture_expect_activation(gen_random_uuid(),t4_26,NULL,'OK');
 PERFORM public.fixture_expect_activation(o_pending,t4_26,o_pending,'OK','rascunho');
 -- Existing active rows do not become uneditable after an academic decision changes.
 v_active:=public.fixture_expect_activation(o_pass,t4_26,o_pass,'OK');
 UPDATE public.fixture_raa_decision
 SET resultado='{"decision":"pendente","destino":"aguardar_dados"}'
 WHERE matricula_id=o_pass;
 UPDATE public.matriculas SET status='ativo' WHERE id=v_active;
 UPDATE public.matriculas SET turma_id=t4_26b WHERE id=v_active;
 -- Changing class without a nonce must NOT bypass RAA.
 BEGIN UPDATE public.matriculas SET turma_id=t3_26 WHERE id=v_active;
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS v_code=MESSAGE_TEXT;
   v_blocked:=(v_code='ENROLLMENT_RAA_DECISION_REQUIRED');
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'DIRECT_CLASS_CORRECTION_ALLOWED'; END IF;
 INSERT INTO public.balcao_pauta_turma_correction_nonce
 VALUES(s,v_active,auth.uid(),t4_26b,t3_26);
 UPDATE public.matriculas SET turma_id=t3_26 WHERE id=v_active;
 IF (SELECT turma_id FROM public.matriculas WHERE id=v_active) IS DISTINCT FROM t3_26
 THEN RAISE EXCEPTION 'AUTHORIZED_CORRECTION_FAILED'; END IF;
 RAISE NOTICE 'RAA_TRIGGER_SYNTHETIC_CASES_PASS';
END;
$cases$;
RESET ROLE;
ROLLBACK;
