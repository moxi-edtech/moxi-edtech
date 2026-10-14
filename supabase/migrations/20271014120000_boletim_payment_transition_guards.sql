-- Gate operacional: executar apenas após aprovação explícita e CI verde.
-- Não modifica RLS, GRANT/REVOKE, ledger, recibos nem funções fiscais.
-- CREATE OR REPLACE mantém a assinatura e os privilégios existentes.
CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_servico(
  p_pagamento_intent_id uuid,
  p_evidence_url text,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_intent public.pagamento_intents%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: Não autenticado ou escola não resolvida.';
  END IF;
  IF NULLIF(trim(COALESCE(p_evidence_url, '')), '') IS NULL
     OR length(p_evidence_url) > 4096 THEN
    RAISE EXCEPTION 'DATA: Comprovativo inválido.';
  END IF;
  SELECT * INTO v_intent FROM public.pagamento_intents
   WHERE id = p_pagamento_intent_id AND escola_id = v_escola_id FOR UPDATE;
  IF v_intent.id IS NULL THEN RAISE EXCEPTION 'DATA: Pedido não encontrado.'; END IF;
  IF NOT public.portal_user_can_access_aluno(v_intent.aluno_id) THEN
    RAISE EXCEPTION 'AUTH: Acesso negado ao aluno.';
  END IF;
  IF v_intent.status IN ('settled', 'paid') THEN
    RAISE EXCEPTION 'STATE: Pagamento já liquidado.';
  END IF;
  IF v_intent.status = 'pending' AND NULLIF(trim(COALESCE(v_intent.evidence_url, '')), '') IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending', 'idempotent', true);
  END IF;
  IF v_intent.status NOT IN ('draft', 'failed', 'pending') THEN
    RAISE EXCEPTION 'STATE: Esta cobrança não aceita comprovativos.';
  END IF;
  UPDATE public.pagamento_intents SET
    status = 'pending',
    evidence_url = p_evidence_url,
    meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
      'submitted_at', now(),
      'mensagem_aluno', NULLIF(trim(p_mensagem), ''),
      'previous_status', v_intent.status
    )
   WHERE id = v_intent.id;
  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'idempotent', false);
END;
$$;

-- Guarda e auditoria restritas ao novo boletim; outros serviços mantêm
-- os contratos e o motor financeiro existentes.
CREATE OR REPLACE FUNCTION public.boletim_payment_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_boletim_payment_before ON public.pagamento_intents;
CREATE TRIGGER trg_boletim_payment_before
 BEFORE UPDATE OF status ON public.pagamento_intents
 FOR EACH ROW EXECUTE FUNCTION public.boletim_payment_transition_guard();
DROP TRIGGER IF EXISTS trg_boletim_payment_after ON public.pagamento_intents;
CREATE TRIGGER trg_boletim_payment_after
 AFTER UPDATE OF status ON public.pagamento_intents
 FOR EACH ROW EXECUTE FUNCTION public.boletim_payment_transition_guard();
