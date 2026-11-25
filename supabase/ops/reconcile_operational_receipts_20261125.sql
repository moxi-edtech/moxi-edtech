-- Controlled production operation: run AFTER migration 20271204020000 is verified.
-- psql -v ON_ERROR_STOP=1 -f this-file. Atomic, exact incident cohort; no payment writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';

DO $$
DECLARE
  d public.documentos_emitidos%ROWTYPE;
  c jsonb;
  v_expected integer := 50;
  v_existing integer;
  v_count integer := 0;
  v_old numeric := 0;
  v_new numeric := 0;
  v_rowcount integer;
BEGIN
  -- Fixed UTC window from the incident audit; not a moving last-30-days query.
  SELECT count(*) INTO v_existing FROM internal.operational_receipt_reconciliation a
  JOIN public.documentos_emitidos x ON x.id=a.documento_id
  WHERE x.created_at >= timestamptz '2026-10-27 07:56:07.830895+00'
    AND x.created_at <= timestamptz '2026-11-25 07:54:42.056862+00'
    AND a.reason='operational_batch_terminal_amount';
  IF v_existing=v_expected THEN
    IF EXISTS (
      SELECT 1 FROM internal.operational_receipt_reconciliation a
      JOIN public.documentos_emitidos x ON x.id=a.documento_id
      WHERE x.created_at >= timestamptz '2026-10-27 07:56:07.830895+00'
        AND x.created_at <= timestamptz '2026-11-25 07:54:42.056862+00'
        AND (x.dados_snapshot->>'valor_pago' IS DISTINCT FROM a.reconciled_total::text
          OR x.hash_validacao IS DISTINCT FROM a.original_hash
          OR x.public_id::text IS DISTINCT FROM a.original_public_id
          OR x.numero_sequencial IS DISTINCT FROM a.original_number
          OR (x.dados_snapshot-'valor_pago') IS DISTINCT FROM (a.original_snapshot-'valor_pago'))
    ) THEN RAISE EXCEPTION 'RECEIPT_RECONCILIATION_REPLAY_DRIFT'; END IF;
    RAISE NOTICE '50 receipts already reconciled; no changes';
    RETURN;
  ELSIF v_existing<>0 THEN RAISE EXCEPTION 'RECEIPT_RECONCILIATION_PARTIAL_RUN'; END IF;

  FOR d IN
    SELECT x.* FROM public.documentos_emitidos x
    WHERE x.tipo='recibo' AND x.revoked_at IS NULL
      AND x.created_at >= timestamptz '2026-10-27 07:56:07.830895+00'
      AND x.created_at <= timestamptz '2026-11-25 07:54:42.056862+00'
      AND jsonb_typeof(x.dados_snapshot->'itens_pagamento')='array'
      AND CASE WHEN x.dados_snapshot->>'valor_pago' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (x.dados_snapshot->>'valor_pago')::numeric IS DISTINCT FROM
          (SELECT sum(CASE WHEN coalesce(i->>'valor',i->>'amount',i->>'preco') ~ '^[0-9]+(\.[0-9]+)?$'
             THEN coalesce(i->>'valor',i->>'amount',i->>'preco')::numeric END)
           FROM jsonb_array_elements(x.dados_snapshot->'itens_pagamento') i)
        ELSE false END
    ORDER BY x.escola_id,x.aluno_id,x.id
  LOOP
    IF d.dados_snapshot->>'pagamento_id' IS NULL THEN RAISE EXCEPTION 'RECEIPT_RECONCILIATION_MISSING_ISSUER'; END IF;
    c := internal.operational_receipt_batch_contract((d.dados_snapshot->>'pagamento_id')::uuid);
    IF c->>'escola_id' IS DISTINCT FROM d.escola_id::text OR c->>'aluno_id' IS DISTINCT FROM d.aluno_id::text
      OR c->>'pagamento_id' IS DISTINCT FROM d.dados_snapshot->>'pagamento_id'
      OR c->'itens_originais' IS DISTINCT FROM d.dados_snapshot->'itens_pagamento'
      OR (d.dados_snapshot->>'valor_pago')::numeric IS DISTINCT FROM
         (SELECT p.valor_pago FROM public.pagamentos p WHERE p.id=(c->>'pagamento_id')::uuid)
      OR d.hash_validacao IS DISTINCT FROM d.dados_snapshot->>'hash_validacao'
      THEN RAISE EXCEPTION 'RECEIPT_RECONCILIATION_EVIDENCE_MISMATCH:%',d.id; END IF;
    INSERT INTO internal.operational_receipt_reconciliation(documento_id,escola_id,aluno_id,
      original_snapshot,original_total,reconciled_total,batch_evidence,original_hash,original_public_id,original_number,reason)
    VALUES(d.id,d.escola_id,d.aluno_id,d.dados_snapshot,(d.dados_snapshot->>'valor_pago')::numeric,
      (c->>'valor_pago')::numeric,c,d.hash_validacao,d.public_id::text,d.numero_sequencial,'operational_batch_terminal_amount');

    -- Keep original document ID, QR token, number, items and dates. Only the incorrect scalar changes.
    UPDATE public.documentos_emitidos x SET dados_snapshot=jsonb_set(x.dados_snapshot,'{valor_pago}',c->'valor_pago',false)
    WHERE x.id=d.id AND x.escola_id=d.escola_id AND x.aluno_id=d.aluno_id
      AND x.revoked_at IS NULL AND x.dados_snapshot=d.dados_snapshot
      AND x.hash_validacao=d.hash_validacao AND x.public_id=d.public_id
      AND x.numero_sequencial IS NOT DISTINCT FROM d.numero_sequencial;
    GET DIAGNOSTICS v_rowcount=ROW_COUNT;
    IF v_rowcount<>1 THEN RAISE EXCEPTION 'RECEIPT_RECONCILIATION_CONCURRENT_CHANGE:%',d.id; END IF;
    v_count:=v_count+1;
    v_old:=v_old+(d.dados_snapshot->>'valor_pago')::numeric;
    v_new:=v_new+(c->>'valor_pago')::numeric;
  END LOOP;
  IF v_count<>v_expected OR v_old<>101900 OR v_new<>527400 THEN
    RAISE EXCEPTION 'RECEIPT_RECONCILIATION_COHORT_DRIFT: %, %, %',v_count,v_old,v_new;
  END IF;
  RAISE NOTICE 'Reconciled % documents: % -> % AOA; all evidence preserved',v_count,v_old,v_new;
END;
$$;
COMMIT;
