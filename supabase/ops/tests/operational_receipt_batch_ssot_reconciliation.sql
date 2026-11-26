-- Recreate the exact aggregate incident cohort with synthetic identities.
DO $$
DECLARE
  school uuid := '00000000-0000-0000-0000-000000000001';
  student uuid;
  mid uuid;
  pid uuid;
  terminal uuid;
  items jsonb;
  batch text;
  fp text;
  amount numeric;
  fee numeric;
  dt timestamptz := '2026-11-01 10:00:00+00';
BEGIN
  FOR i IN 1..50 LOOP
    student:=gen_random_uuid(); mid:=gen_random_uuid(); pid:=gen_random_uuid(); terminal:=gen_random_uuid();
    batch:='synthetic-historic-'||i; fp:='fingerprint-'||i;
    amount:=CASE WHEN i=50 THEN 9000 ELSE 8500 END;
    fee:=CASE WHEN i=50 THEN 3900 ELSE 2000 END;
    items:=jsonb_build_array(jsonb_build_object('tipo','mensalidade','id',mid,'preco',amount),
       jsonb_build_object('tipo','servico','id','synthetic-fee','preco',fee));
    INSERT INTO public.alunos(id,escola_id,nome) VALUES(student,school,'Synthetic historical');
    INSERT INTO public.mensalidades(id,escola_id,aluno_id,status,valor_pago_total) VALUES(mid,school,student,'pago',amount);
    INSERT INTO public.pagamentos(id,escola_id,aluno_id,mensalidade_id,status,valor_pago,meta,created_at)
    VALUES(pid,school,student,mid,'settled',amount,jsonb_build_object('batch_idempotency_key',batch,'batch_fingerprint',fp,'batch_index',0,'emitir_recibo',false,'itens',items),dt),
      (terminal,school,student,NULL,'settled',fee,jsonb_build_object('batch_idempotency_key',batch,'batch_fingerprint',fp,'batch_index',1,'emitir_recibo',true,'itens',items),dt);
    INSERT INTO public.documentos_emitidos(escola_id,aluno_id,tipo,numero_sequencial,dados_snapshot,created_at,hash_validacao)
    VALUES(school,student,'recibo',public.next_documento_numero(school),
      jsonb_build_object('pagamento_id',terminal,'itens_pagamento',items,'valor_pago',fee,'hash_validacao','synthetic-hash-'||i),dt,'synthetic-hash-'||i);
  END LOOP;
END;
$$;

\ir ../reconcile_operational_receipts_20261125.sql
\ir ../reconcile_operational_receipts_20261125.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM internal.operational_receipt_reconciliation)<>50
    OR (SELECT sum(original_total) FROM internal.operational_receipt_reconciliation)<>101900
    OR (SELECT sum(reconciled_total) FROM internal.operational_receipt_reconciliation)<>527400
    OR EXISTS(SELECT 1 FROM internal.operational_receipt_reconciliation a JOIN public.documentos_emitidos d ON d.id=a.documento_id
      WHERE (d.dados_snapshot->>'valor_pago')::numeric IS DISTINCT FROM a.reconciled_total
        OR (d.dados_snapshot-'valor_pago') IS DISTINCT FROM (a.original_snapshot-'valor_pago')
        OR d.hash_validacao IS DISTINCT FROM a.original_hash OR d.public_id::text IS DISTINCT FROM a.original_public_id
        OR d.numero_sequencial IS DISTINCT FROM a.original_number)
    OR (SELECT sum(valor_pago) FROM public.pagamentos WHERE meta->>'batch_idempotency_key' LIKE 'synthetic-historic-%')<>527400
  THEN RAISE EXCEPTION 'historical reconciliation evidence or replay failed'; END IF;
END;
$$;
