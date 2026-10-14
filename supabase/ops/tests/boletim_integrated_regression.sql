-- Both B and C migrations are installed only inside disposable CI PostgreSQL.
-- This is a synthetic database integration test; it is not a browser E2E claim.
DO $$
DECLARE
 v_school uuid := '00000000-0000-4000-8000-000000000101';
 v_student uuid := '00000000-0000-4000-8000-000000000102';
 v_year uuid := '00000000-0000-4000-8000-000000000104';
 v_matricula uuid := '00000000-0000-4000-8000-000000000106';
 v_old_mat uuid := '00000000-0000-4000-8000-000000000107';
 v_order uuid;
 v_intent uuid;
 v_request jsonb;
 v_res jsonb;
 v_failed boolean;
 v_access int;
BEGIN
 PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000103',true);
 PERFORM set_config('test.school',v_school::text,true);
 PERFORM set_config('test.aluno_id',v_student::text,true);
 v_request := public.aluno_solicitar_boletim_matricula(v_school,v_student,v_matricula,v_year);
 v_order := (v_request->>'pedido_id')::uuid;
 v_intent := (v_request->>'pagamento_id')::uuid;
 IF v_request->>'session_id' <> v_year::text OR v_request->>'matricula_id' <> v_matricula::text THEN
   RAISE EXCEPTION 'session mismatch after request'; END IF;

 v_res := public.aluno_submeter_comprovativo_servico(v_intent,'synthetic://proof-v1',NULL);
 IF v_res->>'status' <> 'pending' THEN RAISE EXCEPTION 'proof was not submitted'; END IF;
 v_res := public.aluno_submeter_comprovativo_servico(v_intent,'synthetic://proof-double',NULL);
 IF (v_res->>'idempotent')::boolean IS NOT true THEN RAISE EXCEPTION 'double submission not idempotent'; END IF;
 IF (SELECT evidence_url FROM public.pagamento_intents WHERE id=v_intent) <> 'synthetic://proof-v1' THEN
   RAISE EXCEPTION 'double submission overwrote proof'; END IF;

 UPDATE public.pagamento_intents SET status='failed' WHERE id=v_intent;
 UPDATE public.servico_pedidos SET status='canceled' WHERE id=v_order;
 v_res := public.aluno_submeter_comprovativo_servico(v_intent,'synthetic://proof-v2',NULL);
 IF v_res->>'status' <> 'pending' OR (SELECT evidence_url FROM public.pagamento_intents WHERE id=v_intent) <> 'synthetic://proof-v2' THEN
   RAISE EXCEPTION 'rejection retry failed'; END IF;
 IF (SELECT count(*) FROM public.pagamento_intents WHERE servico_pedido_id=v_order) <> 1 THEN
   RAISE EXCEPTION 'rejection retry created duplicate charge'; END IF;

 -- Existing finance validator owns the accepted transition. No ledger changes here.
 UPDATE public.pagamento_intents SET status='settled' WHERE id=v_intent;
 UPDATE public.servico_pedidos SET status='granted' WHERE id=v_order;
 SELECT count(*) INTO v_access FROM public.servico_pedidos p
 JOIN public.pagamento_intents i ON i.servico_pedido_id=p.id
 WHERE p.id=v_order AND p.escola_id=v_school AND p.aluno_id=v_student
   AND p.matricula_id=v_matricula AND p.status='granted' AND p.valor_cobrado>0 AND i.status='settled';
 IF v_access <> 1 THEN RAISE EXCEPTION 'paid current enrollment not unlocked'; END IF;
 SELECT count(*) INTO v_access FROM public.servico_pedidos p
 JOIN public.pagamento_intents i ON i.servico_pedido_id=p.id
 WHERE p.escola_id=v_school AND p.aluno_id=v_student AND p.matricula_id=v_old_mat
   AND p.status='granted' AND i.status='settled';
 IF v_access <> 0 THEN RAISE EXCEPTION 'historical enrollment gained access'; END IF;

 v_failed := false;
 BEGIN
   PERFORM public.aluno_submeter_comprovativo_servico(v_intent,'synthetic://paid-proof',NULL);
 EXCEPTION WHEN OTHERS THEN v_failed := true;
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'settled service accepted another proof'; END IF;

 SELECT count(*) INTO v_access FROM public.audit_logs
 WHERE entity_id=v_intent::text AND action='BOLETIM_PAGAMENTO_TRANSICAO';
 IF v_access <> 4 THEN RAISE EXCEPTION 'missing audited transitions: %',v_access; END IF;
END
$$;
