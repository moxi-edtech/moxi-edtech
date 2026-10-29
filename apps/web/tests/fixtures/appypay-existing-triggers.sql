-- Snapshot of the two existing production trigger functions, read-only capture on 2026-10-29.
-- Used only by the disposable local test; never apply this fixture to Supabase.
CREATE OR REPLACE FUNCTION public.boletim_payment_transition_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
BEGIN
  SELECT servico_codigo INTO v_code FROM public.servico_pedidos
   WHERE id = NEW.servico_pedido_id AND escola_id = NEW.escola_id;
  IF v_code IS DISTINCT FROM 'DOC_BOLETIM_TRIMESTRAL' THEN RETURN NEW; END IF;

  IF TG_WHEN = 'BEFORE' THEN
    IF OLD.status = 'settled' THEN
      RAISE EXCEPTION 'STATE: boletim já liquidado; não validar novamente.';
    END IF;
    IF OLD.status = 'failed' AND NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'STATE: deve reenviar o comprovativo antes de validar.';
    END IF;
    IF OLD.status = 'draft' AND NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'STATE: comprovativo não submetido.';
    END IF;
    IF OLD.status = 'pending' AND NEW.status NOT IN ('settled', 'failed') THEN
      RAISE EXCEPTION 'STATE: transição de comprovativo inválida.';
    END IF;
    IF OLD.status NOT IN ('draft', 'pending', 'failed') THEN
      RAISE EXCEPTION 'STATE: estado da intenção inválido.';
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs(escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (NEW.escola_id, auth.uid(), 'BOLETIM_PAGAMENTO_TRANSICAO',
          'pagamento_intents', NEW.id::text, 'aluno',
          jsonb_build_object('de', OLD.status, 'para', NEW.status, 'quando', now()));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.financeiro_materialize_intent_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
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
    escola_id,
    aluno_id,
    mensalidade_id,
    pagamento_intent_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    reference,
    evidence_url,
    gateway_ref,
    created_by,
    settled_at,
    settled_by,
    meta,
    idempotency_key
  )
  VALUES (
    NEW.escola_id,
    NEW.aluno_id,
    NULL,
    NEW.id,
    round(NEW.amount::numeric,2),
    COALESCE(NEW.settled_at::date,CURRENT_DATE),
    v_metodo,
    v_legacy,
    'settled',
    NEW.reference,
    NEW.evidence_url,
    NEW.terminal_id,
    NEW.created_by,
    COALESCE(NEW.settled_at,now()),
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
$function$;
