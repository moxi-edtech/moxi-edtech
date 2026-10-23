\set ON_ERROR_STOP on
-- Synthetic only: rejection is an invariant violation, not a skipped check.
-- Idempotency regression is a hard release gate. It is last so the same
-- transaction first exercises approval, rejection and proof resubmission.

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000a14',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a14","escola_id":"00000000-0000-4000-8000-000000000a11"}',false);
DO $$
DECLARE before_amount numeric; after_amount numeric; payment_id uuid;
BEGIN
 SELECT valor_pago_total INTO before_amount FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a16';
 SELECT id INTO payment_id FROM public.pagamentos WHERE mensalidade_id='00000000-0000-4000-8000-000000000a16' ORDER BY created_at DESC LIMIT 1;
 PERFORM public.validar_pagamento(payment_id,true,NULL);
 SELECT valor_pago_total INTO after_amount FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a16';
 IF after_amount IS DISTINCT FROM before_amount THEN
   RAISE EXCEPTION 'FINANCE_IDEMPOTENCY_P0: amount changed on repeated approval (before %, after %)',before_amount,after_amount;
 END IF;
END $$;
RESET ROLE;

\echo FINANCE_IDEMPOTENCY_PASS
