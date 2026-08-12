BEGIN;

-- Mantém o fluxo do aluno e do encarregado consistente com o portal:
-- ambos podem solicitar e acompanhar serviços dos educandos autorizados.
CREATE OR REPLACE FUNCTION public.aluno_solicitar_servico(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_servico_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_serv record;
  v_matricula_id uuid;
  v_pedido_id uuid;
  v_pagamento_id uuid;
  v_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT public.portal_user_can_access_aluno(p_aluno_id) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para solicitar serviços para este aluno.';
  END IF;

  SELECT * INTO v_serv
  FROM public.servicos_escola
  WHERE escola_id = p_escola_id AND codigo = p_servico_codigo AND ativo = true;
  IF v_serv.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Serviço não encontrado ou inativo.';
  END IF;

  SELECT id INTO v_matricula_id
  FROM public.matriculas
  WHERE aluno_id = p_aluno_id AND escola_id = p_escola_id AND status IN ('ativo', 'ativa')
  ORDER BY ano_letivo DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF v_matricula_id IS NULL THEN
    RAISE EXCEPTION 'DATA: O aluno não possui matrícula activa para solicitar este serviço.';
  END IF;

  SELECT id, status INTO v_pedido_id, v_status
  FROM public.servico_pedidos
  WHERE aluno_id = p_aluno_id
    AND escola_id = p_escola_id
    AND servico_codigo = p_servico_codigo
    AND status IN ('pending_payment', 'blocked', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_pedido_id IS NOT NULL THEN
    SELECT id INTO v_pagamento_id FROM public.pagamento_intents WHERE servico_pedido_id = v_pedido_id ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'message', 'Você já possui uma solicitação em andamento.', 'pedido_id', v_pedido_id, 'pagamento_id', v_pagamento_id, 'status', v_status);
  END IF;

  v_status := CASE
    WHEN v_serv.valor_base = 0 AND NOT v_serv.exige_aprovacao THEN 'granted'
    WHEN v_serv.valor_base > 0 THEN 'pending_payment'
    ELSE 'blocked'
  END;

  INSERT INTO public.servico_pedidos (escola_id, aluno_id, matricula_id, servico_escola_id, status, servico_codigo, servico_nome, valor_cobrado, created_by)
  VALUES (p_escola_id, p_aluno_id, v_matricula_id, v_serv.id, v_status, v_serv.codigo, v_serv.nome, v_serv.valor_base, v_actor_id)
  RETURNING id INTO v_pedido_id;

  IF v_serv.valor_base > 0 THEN
    INSERT INTO public.pagamento_intents (escola_id, aluno_id, servico_pedido_id, amount, status, method, created_by)
    VALUES (p_escola_id, p_aluno_id, v_pedido_id, v_serv.valor_base, 'draft', 'transfer', v_actor_id)
    RETURNING id INTO v_pagamento_id;
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (p_escola_id, v_actor_id, 'SERVICO_SOLICITADO_ALUNO', 'servico_pedidos', v_pedido_id::text, 'aluno', jsonb_build_object('servico', p_servico_codigo, 'valor', v_serv.valor_base));

  RETURN jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'pagamento_id', v_pagamento_id, 'status', v_status, 'valor', v_serv.valor_base);
END;
$$;

CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_servico(
  p_pagamento_intent_id uuid,
  p_evidence_url text,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_intent record;
BEGIN
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN RAISE EXCEPTION 'AUTH: Não autenticado ou escola não resolvida.'; END IF;
  SELECT * INTO v_intent FROM public.pagamento_intents WHERE id = p_pagamento_intent_id AND escola_id = v_escola_id;
  IF v_intent.id IS NULL THEN RAISE EXCEPTION 'DATA: Solicitação não encontrada.'; END IF;
  IF NOT public.portal_user_can_access_aluno(v_intent.aluno_id) THEN RAISE EXCEPTION 'AUTH: Você não tem permissão para este recurso.'; END IF;
  IF v_intent.status IN ('settled', 'paid') THEN RAISE EXCEPTION 'STATE: Esta solicitação já está paga e concluída.'; END IF;

  UPDATE public.pagamento_intents
  SET status = 'pending', evidence_url = p_evidence_url, updated_at = now(),
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('submitted_at', now(), 'mensagem_aluno', NULLIF(trim(p_mensagem), ''))
  WHERE id = p_pagamento_intent_id;
  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'message', 'Comprovativo submetido com sucesso. Aguarde a validação da secretaria.');
END;
$$;

DROP POLICY IF EXISTS pagamento_intents_portal_access ON public.pagamento_intents;
CREATE POLICY pagamento_intents_portal_access
ON public.pagamento_intents FOR SELECT TO authenticated
USING (public.portal_user_can_access_aluno(aluno_id));

COMMIT;
