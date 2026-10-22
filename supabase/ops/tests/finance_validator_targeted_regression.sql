\set ON_ERROR_STOP on
-- Uses actual public.validar_pagamento from the new production SQL migration
-- in a real disposable Postgres. All student/school values are synthetic.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a15',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a15","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $test$
BEGIN
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
   RAISE EXCEPTION 'UNAUTHORIZED_TEACHER_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='UNAUTHORIZED_TEACHER_WAS_ACCEPTED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%forbidden%' THEN RAISE; END IF;
 END;
END $test$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000b14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b14","escola_id":"00000000-0000-4000-8000-000000000b11"}',false);
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.pagamentos WHERE escola_id='00000000-0000-4000-8000-000000000a11') THEN
   RAISE EXCEPTION 'CROSS_TENANT_RLS_LEAK';
 END IF;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
   RAISE EXCEPTION 'CROSS_TENANT_SETTLEMENT_ALLOWED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='CROSS_TENANT_SETTLEMENT_ALLOWED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%cross_tenant%' THEN RAISE; END IF;
 END;
END $test$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $test$
DECLARE
 result jsonb;
 before_amount numeric;
 before_receipts integer;
 after_amount numeric;
BEGIN
 -- Approval is a settlement and receipt emission, not just secretary marking.
 result:= public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
 IF result->>'status' <> 'approved' THEN RAISE EXCEPTION 'APPROVAL_STATUS_BAD'; END IF;
 IF result->'recibo'->>'ok' <> 'true' THEN RAISE EXCEPTION 'RECEIPT_NOT_ISSUED'; END IF;
 SELECT valor_pago_total INTO before_amount FROM public.mensalidades
 WHERE id='00000000-0000-4000-8000-000000000a16';
 SELECT count(*) INTO before_receipts FROM public.documentos_emitidos
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16';
 IF before_amount <> 100 OR before_receipts <> 1 THEN
   RAISE EXCEPTION 'WRONG_INITIAL_SETTLEMENT_OR_RECEIPT';
 END IF;
 -- Repeating approval OR reversing the same settled proof must be refused.
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',true,NULL);
   RAISE EXCEPTION 'REPEATED_APPROVAL_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='REPEATED_APPROVAL_ACCEPTED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%pagamento_ja_processado%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a18',false,'bad reversal');
   RAISE EXCEPTION 'REJECTION_AFTER_SETTLEMENT_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='REJECTION_AFTER_SETTLEMENT_ACCEPTED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%pagamento_ja_processado%' THEN RAISE; END IF;
 END;
 SELECT valor_pago_total INTO after_amount FROM public.mensalidades
 WHERE id='00000000-0000-4000-8000-000000000a16';
 IF after_amount IS DISTINCT FROM before_amount THEN RAISE EXCEPTION 'DOUBLE_CHARGE'; END IF;
 IF (SELECT count(*) FROM public.documentos_emitidos
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16') <> before_receipts
 THEN RAISE EXCEPTION 'RECEIPT_DUPLICATED'; END IF;
 -- A rejected proof may not be approved without resubmission.
 result:=public.validar_pagamento('00000000-0000-4000-8000-000000000a28',false,'unreadable fixture');
 IF result->>'status' <> 'rejected' THEN RAISE EXCEPTION 'REJECTION_DID_NOT_HAPPEN'; END IF;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a28',true,NULL);
   RAISE EXCEPTION 'REJECTED_PROOF_APPROVED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='REJECTED_PROOF_APPROVED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%pagamento_ja_processado%' THEN RAISE; END IF;
 END;
 IF (SELECT valor_pago_total FROM public.mensalidades
 WHERE id='00000000-0000-4000-8000-000000000a26') <> 0 THEN
  RAISE EXCEPTION 'REJECTED_PROOF_CHANGED_BALANCE';
 END IF;
END $test$;
RESET ROLE;

-- Synthetic new proof on the SAME monthly request, rather than reopening a
-- rejected/settled ledger entry. In the full app this is the upload RPC.
INSERT INTO public.pagamentos (id,escola_id,mensalidade_id,valor_pago) VALUES
('00000000-0000-4000-8000-000000000a30','00000000-0000-4000-8000-000000000a11','00000000-0000-4000-8000-000000000a26',50);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $test$
DECLARE result jsonb;
BEGIN
 result := public.validar_pagamento('00000000-0000-4000-8000-000000000a30',true,NULL);
 IF result->>'status'<>'approved' THEN RAISE EXCEPTION 'RESUBMIT_NOT_APPROVED'; END IF;
 IF (SELECT valor_pago_total FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a26')<>50 THEN
   RAISE EXCEPTION 'RESUBMISSION_DOUBLED_CHARGE';
 END IF;
 IF (SELECT count(*) FROM public.pagamentos
 WHERE mensalidade_id='00000000-0000-4000-8000-000000000a26' AND status='settled') <> 1 THEN
   RAISE EXCEPTION 'RESUBMISSION_MORE_THAN_ONE_SETTLEMENT';
 END IF;
 -- Services use the same pending-only rule and must not be canceled after grant.
 result := public.validar_pagamento('00000000-0000-4000-8000-000000000a31',true,NULL);
 IF result->>'status'<>'approved' THEN RAISE EXCEPTION 'SERVICE_NOT_GRANTED'; END IF;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a31',false,'reverse');
   RAISE EXCEPTION 'SERVICE_GRANTED_THEN_REJECTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='SERVICE_GRANTED_THEN_REJECTED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%comprovativo_ja_processado%' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.servico_pedidos WHERE id='00000000-0000-4000-8000-000000000a21') <> 'granted' THEN
   RAISE EXCEPTION 'SERVICE_INCORRECTLY_REVOKED';
 END IF;
 result:= public.validar_pagamento('00000000-0000-4000-8000-000000000a32',false,'fixture unreadable');
 IF result->>'status'<>'rejected' THEN RAISE EXCEPTION 'SERVICE_REJECTION_MISSING'; END IF;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a32',true,NULL);
   RAISE EXCEPTION 'SERVICE_FAILED_REAPPROVED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='SERVICE_FAILED_REAPPROVED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%comprovativo_ja_processado%' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.validar_pagamento('00000000-0000-4000-8000-000000000a33',true,NULL);
   RAISE EXCEPTION 'UNSUBMITTED_SERVICE_APPROVED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='UNSUBMITTED_SERVICE_APPROVED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%comprovativo_ja_processado%' THEN RAISE; END IF;
 END;
END $test$;
RESET ROLE;

-- Synthetic reupload changes existing service intent back to pending (like the
-- canonical aluno_submeter_comprovativo_servico RPC), before office validation.
UPDATE public.pagamento_intents SET status='pending' WHERE id='00000000-0000-4000-8000-000000000a32';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $test$
BEGIN
 IF (public.validar_pagamento('00000000-0000-4000-8000-000000000a32',true,NULL)->>'status') <> 'approved'
 THEN RAISE EXCEPTION 'RESUBMITTED_SERVICE_NOT_APPROVED'; END IF;
END $test$;
RESET ROLE;
\echo FINANCE_VALIDATOR_TARGETED_REGRESSIONS_PASS
