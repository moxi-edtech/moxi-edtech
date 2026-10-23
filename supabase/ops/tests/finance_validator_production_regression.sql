\set ON_ERROR_STOP on
-- All IDs below are synthetic. Uses actual production validator plus narrow guards.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a15',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a15","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $t$ BEGIN
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
  RAISE EXCEPTION 'TEACHER_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='TEACHER_ALLOWED' OR SQLERRM NOT LIKE '%forbidden%' THEN RAISE; END IF;
 END;
END $t$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b14","escola_id":"00000000-0000-4000-8000-000000000b11"}',false);
DO $t$ BEGIN
 IF EXISTS(SELECT 1 FROM public.pagamentos WHERE escola_id='00000000-0000-4000-8000-000000000a11') THEN RAISE EXCEPTION 'RLS_LEAK'; END IF;
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
  RAISE EXCEPTION 'CROSS_TENANT_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='CROSS_TENANT_ALLOWED' OR SQLERRM NOT LIKE '%cross_tenant%' THEN RAISE; END IF;
 END;
END $t$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $t$
DECLARE r jsonb;
BEGIN
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
 IF r->>'status'<>'approved' OR r->>'idempotent'<>'false' THEN RAISE EXCEPTION 'MONTHLY_FIRST_APPROVAL'; END IF;
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
 IF r->>'idempotent'<>'true' THEN RAISE EXCEPTION 'MONTHLY_REPLAY_NOT_IDEMPOTENT'; END IF;
 IF (SELECT valor_pago_total FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a16')<>100 THEN RAISE EXCEPTION 'MONTHLY_DOUBLE_CHARGE'; END IF;
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',false,'reverse');
  RAISE EXCEPTION 'MONTHLY_REVERSED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='MONTHLY_REVERSED' OR SQLERRM NOT LIKE '%pendente%' THEN RAISE; END IF;
 END;
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a31',true,NULL);
 IF r->>'status'<>'approved' THEN RAISE EXCEPTION 'SERVICE_GRANT_FAILED'; END IF;
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a31',true,NULL);
 IF r->>'idempotent'<>'true' THEN RAISE EXCEPTION 'SERVICE_REPLAY_NOT_IDEMPOTENT'; END IF;
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a31',false,'reverse');
  RAISE EXCEPTION 'GRANTED_SERVICE_REVOKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='GRANTED_SERVICE_REVOKED' OR SQLERRM NOT LIKE '%pendente%' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.servico_pedidos WHERE id='00000000-0000-4000-8000-000000000a21')<>'granted' THEN RAISE EXCEPTION 'SERVICE_REVOKED'; END IF;
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a32',false,'invalid proof');
 IF r->>'status'<>'rejected' THEN RAISE EXCEPTION 'SERVICE_REJECT_FAILED'; END IF;
 r:=public.validar_pagamento('00000000-0000-4000-8000-000000000a32',false,'invalid proof');
 IF r->>'idempotent'<>'true' THEN RAISE EXCEPTION 'SERVICE_REJECTION_NOT_IDEMPOTENT'; END IF;
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a32',true,NULL);
  RAISE EXCEPTION 'REJECTED_SERVICE_APPROVED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='REJECTED_SERVICE_APPROVED' OR SQLERRM NOT LIKE '%pendente%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a33',true,NULL);
  RAISE EXCEPTION 'FAILED_SERVICE_APPROVED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='FAILED_SERVICE_APPROVED' OR SQLERRM NOT LIKE '%pendente%' THEN RAISE; END IF;
 END;
END $t$;
RESET ROLE;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.financeiro_pagamento_alocacoes WHERE pagamento_id='00000000-0000-4000-8000-000000000a18')<>1 THEN RAISE EXCEPTION 'MONTHLY_DUPLICATE_ALLOCATION'; END IF;
END $t$;
\echo FINANCE_VALIDATOR_PRODUCTION_REGRESSION_PASS

-- Real production allocation contract: one financial movement, one fiscal
-- allocation, exact invoice split, and no second audit/ledger side effect.
DO $fiscal_invariants$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.financeiro_pagamento_alocacoes
  WHERE pagamento_id='00000000-0000-4000-8000-000000000a18'
    AND mensalidade_id='00000000-0000-4000-8000-000000000a16'
    AND natureza='aplicacao'
    AND fiscal_documento_origem_id='00000000-0000-4000-8000-000000000a40'
    AND valor_bruto_aoa=100
    AND valor_liquido_aoa=90
    AND valor_imposto_aoa=10
    AND metadata->>'allocation_method'='proportional_residual_v1';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PRODUCTION_FISCAL_SPLIT_OR_IDEMPOTENCY_BROKEN';
  END IF;

  SELECT count(*) INTO v_count FROM public.audit_logs
    WHERE action='PAGAMENTO_ALOCADO'
      AND entity_id='00000000-0000-4000-8000-000000000a18';
  IF v_count <> 1 THEN RAISE EXCEPTION 'ALLOCATION_AUDITED_MORE_THAN_ONCE'; END IF;

  SELECT count(*) INTO v_count FROM public.financeiro_lancamentos
    WHERE escola_id='00000000-0000-4000-8000-000000000a11'
      AND status='pago' AND metodo_pagamento='numerario'
      AND origem='mensalidade' AND tipo='debito';
  IF v_count <> 1 THEN RAISE EXCEPTION 'MONTHLY_LEDGER_NOT_SETTLED'; END IF;

  SELECT count(*) INTO v_count FROM public.financeiro_pagamento_alocacoes
    WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16' AND natureza='aplicacao';
  IF v_count <> 1 THEN RAISE EXCEPTION 'MONTHLY_ALLOCATION_REPLAY_DUPLICATE'; END IF;
END $fiscal_invariants$;
\echo FINANCE_VALIDATOR_REAL_ALLOCATOR_AND_FISCAL_SPLIT_PASS

-- Additional RLS regression for actual production allocator output.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $own_finance$
BEGIN
  IF (SELECT count(*) FROM public.financeiro_pagamento_alocacoes
      WHERE pagamento_id='00000000-0000-4000-8000-000000000a18')<>1
  THEN RAISE EXCEPTION 'OWN_FINANCIAL_ALLOCATION_HIDDEN'; END IF;
END $own_finance$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b14","escola_id":"00000000-0000-4000-8000-000000000b11"}',false);
DO $cross_finance$
BEGIN
  IF EXISTS (SELECT 1 FROM public.financeiro_pagamento_alocacoes
             WHERE escola_id='00000000-0000-4000-8000-000000000a11')
     OR EXISTS (SELECT 1 FROM public.audit_logs
             WHERE escola_id='00000000-0000-4000-8000-000000000a11')
     OR EXISTS (SELECT 1 FROM public.financeiro_lancamentos
             WHERE escola_id='00000000-0000-4000-8000-000000000a11')
  THEN RAISE EXCEPTION 'CROSS_TENANT_FINANCIAL_RLS_LEAK'; END IF;
END $cross_finance$;
RESET ROLE;
\echo FINANCE_VALIDATOR_PRODUCTION_FINANCIAL_RLS_PASS
