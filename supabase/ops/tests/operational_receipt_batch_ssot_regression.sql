-- Synthetic service-terminated batch mirrors the production shape without PII.
INSERT INTO public.alunos VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Synthetic','BI');
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000001',NULL);
INSERT INTO public.mensalidades(id,escola_id,aluno_id,status,valor_pago_total,ano_letivo,ano_referencia,mes_referencia)
VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','pago',3000,2026,2026,9),
('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','pago',3000,2026,2026,10),
('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','pago',3000,2026,2026,11);
INSERT INTO public.pagamentos(id,escola_id,aluno_id,mensalidade_id,status,valor_pago,meta)
SELECT id::uuid,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',mid::uuid,'settled',amount,
jsonb_build_object('batch_idempotency_key','synthetic-batch','batch_fingerprint','synthetic-fingerprint','batch_index',idx,'emitir_recibo',idx=3,'origem','rematricula_balcao','itens',
'[{"tipo":"mensalidade","id":"00000000-0000-0000-0000-000000000003","preco":3000},{"tipo":"mensalidade","id":"00000000-0000-0000-0000-000000000004","preco":3000},{"tipo":"mensalidade","id":"00000000-0000-0000-0000-000000000005","preco":3000},{"tipo":"servico","id":"synthetic-fee","preco":1800}]'::jsonb)
FROM (VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000003',3000,0),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000004',3000,1),
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000005',3000,2),
('00000000-0000-0000-0000-000000000014',NULL,1800,3)) p(id,mid,amount,idx);

DO $$
DECLARE c jsonb; d1 jsonb; d2 jsonb; d3 jsonb; d public.documentos_emitidos%ROWTYPE;
BEGIN
  c := internal.operational_receipt_batch_contract('00000000-0000-0000-0000-000000000011');
  IF (c->>'valor_pago')::numeric<>10800 OR jsonb_array_length(c->'pagamentos_ids')<>4 THEN RAISE EXCEPTION 'wrong contract: %',c; END IF;
  d1 := public._emitir_recibo_servicos_operacional_internal('00000000-0000-0000-0000-000000000014');
  d2 := public._emitir_recibo_operacional_internal('00000000-0000-0000-0000-000000000003');
  d3 := public.emitir_recibo_system('00000000-0000-0000-0000-000000000005');
  IF coalesce(d1->>'ok','false')<>'true' OR d1->>'doc_id' IS DISTINCT FROM d2->>'doc_id'
    OR d1->>'doc_id' IS DISTINCT FROM d3->>'doc_id' OR (SELECT count(*) FROM public.documentos_emitidos)<>1 THEN
    RAISE EXCEPTION 'batch identity differs: %, %, %',d1,d2,d3; END IF;
  SELECT * INTO STRICT d FROM public.documentos_emitidos;
  IF (d.dados_snapshot->>'valor_pago')::numeric<>10800 OR d.dados_snapshot->>'pagamento_id'<>'00000000-0000-0000-0000-000000000014'
    OR d.dados_snapshot->'itens_pagamento'->0->>'pagamento_id'<>'00000000-0000-0000-0000-000000000011'
    OR (SELECT sum(valor_pago) FROM public.pagamentos)<>10800 THEN RAISE EXCEPTION 'wrong snapshot or ledger mutation'; END IF;
  IF has_function_privilege('authenticated','internal.operational_receipt_batch_contract(uuid)','EXECUTE')
    OR has_function_privilege('anon','internal.issue_operational_batch_receipt(uuid,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','internal.operational_receipt_reconciliation','SELECT') THEN RAISE EXCEPTION 'private privilege leaked'; END IF;

  BEGIN
    UPDATE public.pagamentos SET status='voided' WHERE id='00000000-0000-0000-0000-000000000011';
    PERFORM internal.operational_receipt_batch_contract('00000000-0000-0000-0000-000000000014');
    RAISE EXCEPTION 'voided payment incorrectly accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RECEIPT_BATCH_UNSETTLED_OR_AMBIGUOUS' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.pagamentos SET valor_pago=2900 WHERE id='00000000-0000-0000-0000-000000000011';
    PERFORM internal.operational_receipt_batch_contract('00000000-0000-0000-0000-000000000014');
    RAISE EXCEPTION 'mismatching amount incorrectly accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RECEIPT_BATCH_ITEM_PAYMENT_MISMATCH' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.pagamentos SET meta=jsonb_set(meta,'{emitir_recibo}','true') WHERE id='00000000-0000-0000-0000-000000000011';
    PERFORM internal.operational_receipt_batch_contract('00000000-0000-0000-0000-000000000014');
    RAISE EXCEPTION 'ambiguous issuer incorrectly accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RECEIPT_BATCH_UNSETTLED_OR_AMBIGUOUS' THEN RAISE; END IF;
  END;
END;
$$;

INSERT INTO public.operational_receipt_worker_control VALUES(true,now()-interval '1 day',true);
INSERT INTO public.outbox_events(escola_id,event_type,dedupe_key,idempotency_key,payload)
VALUES('00000000-0000-0000-0000-000000000001','financeiro_recibo_pagamento','test','test','{"pagamento_id":"00000000-0000-0000-0000-000000000014"}');
DO $$
DECLARE x record;
BEGIN
  SELECT * INTO x FROM public.process_operational_receipt_outbox(10);
  IF x.issued_count<>1 OR x.failed_count<>0 OR (SELECT count(*) FROM public.documentos_emitidos)<>1
     OR (SELECT status FROM public.outbox_events WHERE dedupe_key='test')<>'sent' THEN RAISE EXCEPTION 'worker replay did not reuse existing receipt: %',x; END IF;
END;
$$;
