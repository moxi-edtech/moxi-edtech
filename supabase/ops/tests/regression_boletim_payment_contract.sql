-- Contratos de pedido, comprovativo, idempotência e auditoria do boletim.
DO $$
DECLARE
  v_school uuid := '00000000-0000-4000-8000-000000000001';
  v_student uuid := '00000000-0000-4000-8000-000000000002';
  v_actor uuid := '00000000-0000-4000-8000-000000000003';
  v_order uuid := '00000000-0000-4000-8000-000000000004';
  v_intent uuid := '00000000-0000-4000-8000-000000000005';
  v_result jsonb;
  v_rejected boolean;
  v_count int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM set_config('test.escola_id', v_school::text, true);
  PERFORM set_config('test.aluno_id', v_student::text, true);
  INSERT INTO public.servico_pedidos VALUES
    (v_order, v_school, v_student, 'DOC_BOLETIM_TRIMESTRAL',
     '00000000-0000-4000-8000-000000000006', 'pending_payment', 100);
  INSERT INTO public.pagamento_intents(id, escola_id, aluno_id, servico_pedido_id, status)
    VALUES(v_intent, v_school, v_student, v_order, 'draft');

  v_result := public.aluno_submeter_comprovativo_servico(v_intent, 'synthetic://proof-1', NULL);
  IF v_result->>'status' <> 'pending' OR (v_result->>'idempotent')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'Primeiro envio inválido';
  END IF;
  v_result := public.aluno_submeter_comprovativo_servico(v_intent, 'synthetic://proof-duplicate', NULL);
  IF (v_result->>'idempotent')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Duplo envio não é idempotente'; END IF;
  IF (SELECT evidence_url FROM public.pagamento_intents WHERE id = v_intent) <> 'synthetic://proof-1' THEN
    RAISE EXCEPTION 'Duplo envio substituiu evidência';
  END IF;
  UPDATE public.pagamento_intents SET status = 'failed' WHERE id = v_intent;
  v_rejected := false;
  BEGIN
    UPDATE public.pagamento_intents SET status = 'failed' WHERE id = v_intent;
  EXCEPTION WHEN OTHERS THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Rejeição repetida deveria bloquear'; END IF;

  v_result := public.aluno_submeter_comprovativo_servico(v_intent, 'synthetic://proof-2', NULL);
  IF (v_result->>'idempotent')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'Reenvio falhou'; END IF;
  IF (SELECT evidence_url FROM public.pagamento_intents WHERE id = v_intent) <> 'synthetic://proof-2' THEN
    RAISE EXCEPTION 'Reenvio não reutilizou intenção';
  END IF;
  UPDATE public.pagamento_intents SET status = 'settled' WHERE id = v_intent;
  v_rejected := false;
  BEGIN
    UPDATE public.pagamento_intents SET status = 'settled' WHERE id = v_intent;
  EXCEPTION WHEN OTHERS THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Aprovação repetida deveria bloquear'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.aluno_submeter_comprovativo_servico(v_intent, 'synthetic://proof-3', NULL);
  EXCEPTION WHEN OTHERS THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Liquidado não aceita novo comprovativo'; END IF;
  SELECT count(*) INTO v_count FROM public.pagamento_intents WHERE servico_pedido_id = v_order;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Reenvio criou cobrança adicional'; END IF;
  SELECT count(*) INTO v_count FROM public.audit_logs
    WHERE entity_id = v_intent::text AND action = 'BOLETIM_PAGAMENTO_TRANSICAO';
  IF v_count <> 4 THEN RAISE EXCEPTION 'Auditoria incompleta: % transições', v_count; END IF;
END;
$$;
