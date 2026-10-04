BEGIN;

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS pagamento_intent_id uuid NULL;

ALTER TABLE public.pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_pagamento_intent_id_fkey;

ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_pagamento_intent_id_fkey
  FOREIGN KEY (pagamento_intent_id)
  REFERENCES public.pagamento_intents(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pagamentos_pagamento_intent
  ON public.pagamentos(pagamento_intent_id)
  WHERE pagamento_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.financeiro_materialize_intent_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','extensions'
AS $bill$
DECLARE
  v_metodo public.pagamento_metodo;
  v_legacy text;
BEGIN
  IF NEW.status <> 'settled'
     OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM 'settled') THEN
    RETURN NEW;
  END IF;

  v_metodo := CASE lower(COALESCE(NEW.method,''))
    WHEN 'cash' THEN 'cash'::public.pagamento_metodo
    WHEN 'tpa' THEN 'tpa'::public.pagamento_metodo
    WHEN 'transfer' THEN 'transfer'::public.pagamento_metodo
    WHEN 'mcx' THEN 'mcx'::public.pagamento_metodo
    WHEN 'kiwk' THEN 'kwik'::public.pagamento_metodo
    WHEN 'kwik' THEN 'kwik'::public.pagamento_metodo
    ELSE NULL
  END;

  IF v_metodo IS NULL THEN
    RAISE EXCEPTION 'STATE: método do pagamento intent não possui mapeamento canónico';
  END IF;

  v_legacy := CASE v_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
  END;

  INSERT INTO public.pagamentos (
    escola_id, aluno_id, mensalidade_id, pagamento_intent_id,
    valor_pago, data_pagamento, metodo, metodo_pagamento, status,
    reference, evidence_url, gateway_ref, created_by, settled_at,
    settled_by, meta, idempotency_key
  )
  VALUES (
    NEW.escola_id, NEW.aluno_id, NULL, NEW.id,
    round(NEW.amount::numeric,2), COALESCE(NEW.settled_at::date,CURRENT_DATE),
    v_metodo, v_legacy, 'settled', NEW.reference, NEW.evidence_url,
    NEW.terminal_id, NEW.created_by, COALESCE(NEW.settled_at,now()),
    NEW.created_by,
    COALESCE(NEW.meta,'{}'::jsonb) ||
      jsonb_build_object(
        'origem','pagamento_intent',
        'pagamento_intent_id',NEW.id,
        'servico_pedido_id',NEW.servico_pedido_id
      ),
    format('intent:%s',NEW.id)
  )
  ON CONFLICT (pagamento_intent_id)
  WHERE pagamento_intent_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_financeiro_materialize_intent_payment
ON public.pagamento_intents;

CREATE TRIGGER trg_financeiro_materialize_intent_payment
AFTER INSERT OR UPDATE ON public.pagamento_intents
FOR EACH ROW EXECUTE FUNCTION public.financeiro_materialize_intent_payment();

REVOKE EXECUTE ON FUNCTION public.financeiro_materialize_intent_payment()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_emitir_recibo_intent_rematricula
ON public.pagamento_intents;

REVOKE EXECUTE ON FUNCTION public.emitir_recibo(uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.emitir_recibo_system(uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.emitir_recibo_servicos(uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.emitir_recibo_intent_rematricula(uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.emitir_recibo_intent_rematricula_after_settled()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.trigger_pagamento_recibo_outbox()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.financeiro_guard_mensalidade_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  IF current_user <> 'postgres' THEN
    IF NEW.valor_pago_total IS DISTINCT FROM OLD.valor_pago_total
       OR NEW.data_pagamento_efetiva IS DISTINCT FROM OLD.data_pagamento_efetiva
       OR NEW.metodo_pagamento IS DISTINCT FROM OLD.metodo_pagamento
       OR (
         NEW.status IS DISTINCT FROM OLD.status
         AND (
           NEW.status IN ('pago','pago_parcial')
           OR OLD.status IN ('pago','pago_parcial')
         )
       ) THEN
      RAISE EXCEPTION
        'IMMUTABILITY: campos de liquidação da mensalidade exigem RPC canónica';
    END IF;
  END IF;
  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_mensalidades_payment_fields_guard
ON public.mensalidades;

CREATE TRIGGER trg_mensalidades_payment_fields_guard
BEFORE UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.financeiro_guard_mensalidade_payment_fields();

CREATE OR REPLACE FUNCTION public.financeiro_guard_fiscalized_payment_reversal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
DECLARE
  v_doc_status text;
BEGIN
  IF OLD.status IN ('settled','concluido','pago')
     AND NEW.status IN ('voided','estornado','cancelado')
     AND OLD.fiscal_documento_id IS NOT NULL THEN
    SELECT status INTO v_doc_status
    FROM public.fiscal_documentos
    WHERE id=OLD.fiscal_documento_id;

    IF COALESCE(v_doc_status,'') <> 'anulado' THEN
      RAISE EXCEPTION
        'STATE: pagamento fiscalizado exige anulação/correcção fiscal antes da reversão financeira';
    END IF;
  END IF;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_pagamentos_fiscal_reversal_guard
ON public.pagamentos;

CREATE TRIGGER trg_pagamentos_fiscal_reversal_guard
BEFORE UPDATE OF status ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_guard_fiscalized_payment_reversal();

COMMIT;