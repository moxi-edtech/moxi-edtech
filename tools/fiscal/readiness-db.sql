-- KLASSE fiscal readiness DB checks.
-- Run only against a staging/branch clone with representative data.
-- The destructive-looking checks are wrapped in transactions and rolled back.
-- Concurrency 2/100 is exercised by tools/fiscal/readiness-concurrency.mjs.

\set ON_ERROR_STOP on

-- 1. BILL-001/002 permanent immutability negatives.
BEGIN;
ALTER TABLE public.fiscal_documento_itens
  DISABLE TRIGGER trg_fiscal_documento_itens_consistency;

DO $test$
DECLARE
  v_doc uuid;
  v_item uuid;
  v_event uuid;
  v_err text;
BEGIN
  SELECT id INTO v_doc
  FROM public.fiscal_documentos
  WHERE status='emitido'
  ORDER BY created_at
  LIMIT 1;

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'TEST_SETUP: no emitted fiscal document';
  END IF;

  SELECT id INTO v_item
  FROM public.fiscal_documento_itens
  WHERE documento_id=v_doc
  ORDER BY linha_no
  LIMIT 1;

  SELECT id INTO v_event
  FROM public.fiscal_documentos_eventos
  WHERE documento_id=v_doc
  ORDER BY created_at
  LIMIT 1;

  BEGIN
    DELETE FROM public.fiscal_documentos WHERE id=v_doc;
    RAISE EXCEPTION 'TEST_FAIL: DELETE fiscal_documentos accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
  END;

  IF v_item IS NOT NULL THEN
    BEGIN
      UPDATE public.fiscal_documento_itens
      SET descricao=descricao || ' readiness-tamper'
      WHERE id=v_item;
      RAISE EXCEPTION 'TEST_FAIL: UPDATE fiscal_documento_itens accepted';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
      IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
    END;
  END IF;

  IF v_event IS NOT NULL THEN
    BEGIN
      DELETE FROM public.fiscal_documentos_eventos WHERE id=v_event;
      RAISE EXCEPTION 'TEST_FAIL: DELETE fiscal_documentos_eventos accepted';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
      IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
    END;
  END IF;
END
$test$;
ROLLBACK;

-- 2. Financial append-only objects.
BEGIN;
DO $test$
DECLARE
  v_id uuid;
  v_old numeric;
  v_err text;
BEGIN
  SELECT id,valor INTO v_id,v_old
  FROM public.financeiro_ledger
  ORDER BY created_at
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'TEST_SETUP: no financeiro_ledger fixture';
  END IF;

  BEGIN
    UPDATE public.financeiro_ledger SET valor=v_old+1 WHERE id=v_id;
    RAISE EXCEPTION 'TEST_FAIL: UPDATE financeiro_ledger accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public.financeiro_ledger WHERE id=v_id;
    RAISE EXCEPTION 'TEST_FAIL: DELETE financeiro_ledger accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
  END;
END
$test$;
ROLLBACK;

-- 3. Payment-intent duplicate protection.
BEGIN;
DO $test$
DECLARE
  v_row public.pagamento_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.pagamento_intents
  ORDER BY created_at
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'TEST_SETUP: no pagamento_intents fixture';
  END IF;

  BEGIN
    INSERT INTO public.pagamento_intents(
      escola_id,aluno_id,servico_pedido_id,amount,currency,method,status,
      reference,terminal_id,evidence_url,meta,created_by,idempotency_key
    )
    VALUES(
      v_row.escola_id,v_row.aluno_id,v_row.servico_pedido_id,v_row.amount,
      v_row.currency,v_row.method,v_row.status,v_row.reference,v_row.terminal_id,
      v_row.evidence_url,v_row.meta,v_row.created_by,v_row.idempotency_key
    );
    RAISE EXCEPTION 'TEST_FAIL: duplicate payment intent accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$test$;
ROLLBACK;

-- 3b. BILL-018 prospective payment idempotency + immutable identity.
BEGIN;
DO $test$
DECLARE
  v_school uuid;
  v_payment uuid;
  v_err text;
BEGIN
  SELECT escola_id,id
    INTO v_school,v_payment
  FROM public.pagamentos
  ORDER BY created_at
  LIMIT 1;

  IF v_school IS NULL OR v_payment IS NULL THEN
    RAISE EXCEPTION 'TEST_SETUP: no pagamentos fixture';
  END IF;

  BEGIN
    INSERT INTO public.pagamentos(
      escola_id,valor_pago,status,metodo,meta
    ) VALUES (
      v_school,1.00,'pending','cash','{}'::jsonb
    );
    RAISE EXCEPTION 'TEST_FAIL: payment without idempotency key accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    IF position('IDEMPOTENCY:' in v_err)=0 THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.pagamentos
    SET idempotency_key='readiness:forbidden-reidentity'
    WHERE id=v_payment;
    RAISE EXCEPTION 'TEST_FAIL: payment idempotency key mutation accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    IF position('IMMUTABILITY:' in v_err)=0 THEN RAISE; END IF;
  END;
END
$test$;
ROLLBACK;

-- 4. Schema invariants that protect concurrency/idempotency.
DO $test$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='fiscal_emitir_documento'
  ) <> 1 THEN
    RAISE EXCEPTION 'TEST_FAIL: fiscal_emitir_documento overload drift';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='fiscal_documentos'
      AND indexname='ux_fiscal_documentos_origin_identity'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: fiscal origin identity unique index missing';
  END IF;

  IF position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef(
      'public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text,text)'::regprocedure
    )
  )=0 THEN
    RAISE EXCEPTION 'TEST_FAIL: integrated-origin advisory lock missing';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='pagamento_intents'
      AND indexname='ux_pagamento_intents_escola_idempotency'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: payment intent idempotency unique index missing';
  END IF;
END
$test$;

-- 4b. BILL-018 payment idempotency invariants.
DO $test$
DECLARE
  v_insert_guard text;
  v_update_guard text;
BEGIN
  IF NOT EXISTS(
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='pagamentos'
      AND indexname='ux_pagamentos_escola_idempotency'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: payment idempotency unique index missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.financeiro_guard_pagamento_insert()'::regprocedure
  ) INTO v_insert_guard;

  IF position('IDEMPOTENCY:' in v_insert_guard)=0
     OR position('idempotency_key' in v_insert_guard)=0 THEN
    RAISE EXCEPTION 'TEST_FAIL: new-payment idempotency guard missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.financeiro_guard_pagamento_update()'::regprocedure
  ) INTO v_update_guard;

  IF position('idempotency_key do pagamento não pode ser alterada' in v_update_guard)=0 THEN
    RAISE EXCEPTION 'TEST_FAIL: payment idempotency immutability guard missing';
  END IF;

  -- Historical NULLs are intentionally preserved by keeping the physical
  -- column nullable. The INSERT trigger enforces the rule prospectively.
  IF (
    SELECT a.attnotnull
    FROM pg_attribute a
    WHERE a.attrelid='public.pagamentos'::regclass
      AND a.attname='idempotency_key'
      AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: BILL-018 unexpectedly forced historical NOT NULL';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.registrar_pagamento(uuid,text,text,numeric,date)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: non-idempotent legacy payment RPC remains exposed';
  END IF;
END
$test$;

-- 4c. Official AGT arithmetic examples from registarFactura documentation.
DO $test$
DECLARE
  v_tax_engine text;
BEGIN
  IF public.fiscal_tax_ceil_cent(23.144::numeric) <> 23.15::numeric
     OR public.fiscal_tax_ceil_cent(0.001844::numeric) <> 0.01::numeric
     OR public.fiscal_tax_ceil_cent(5.9999999::numeric) <> 6.00::numeric THEN
    RAISE EXCEPTION 'TEST_FAIL: AGT taxContribution ceil-cent examples diverged';
  END IF;

  SELECT pg_get_functiondef(
    'public.fiscal_tax_compute_document(jsonb,date,text,text,numeric)'::regprocedure
  ) INTO v_tax_engine;

  IF position('v_line_tax := public.fiscal_tax_ceil_cent' in v_tax_engine)=0 THEN
    RAISE EXCEPTION 'TEST_FAIL: canonical tax engine no longer uses ceil-cent taxContribution';
  END IF;

  IF position('v_gross_aoa := round(v_gross*v_exchange,2)' in v_tax_engine)=0 THEN
    RAISE EXCEPTION 'TEST_FAIL: canonical FX gross total no longer rounds to 2 decimals';
  END IF;
END
$test$;

-- 5. AGT retry identity/DLQ controls.
DO $test$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='fiscal_agt_submissions'
      AND column_name='dead_lettered_at'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: AGT DLQ state missing';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.fiscal_agt_replay_dead_letter(uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEST_FAIL: AGT DLQ replay exposed to authenticated';
  END IF;
END
$test$;

SELECT 'PASS' AS fiscal_readiness_db;
