BEGIN;

-- =================================================================
-- ADICIONA AUDITORIA A RPCs FINANCEIRAS CRÍTICAS
-- =================================================================

-- == 1. ATUALIZAR `registrar_pagamento` ==

CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_mensalidade_id uuid,
  p_metodo_pagamento text,
  p_observacao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_valor_pago numeric;
BEGIN
  -- Lock otimista para evitar concorrência em múltiplas baixas
  SELECT * INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada.');
  END IF;

  IF v_mensalidade.status = 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta mensalidade já foi paga.');
  END IF;

  v_valor_pago := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor);

  UPDATE public.mensalidades
  SET
    status = 'pago',
    valor_pago_total = v_valor_pago,
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = p_observacao,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  -- Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    v_mensalidade.escola_id,
    v_user_id,
    'PAGAMENTO_REGISTRADO',
    'mensalidades',
    p_mensalidade_id::text,
    'financeiro',
    jsonb_build_object(
        'metodo', p_metodo_pagamento,
        'obs', p_observacao,
        'valor_pago', v_valor_pago
    ),
    jsonb_build_object('status', v_mensalidade.status),
    jsonb_build_object('status', 'pago')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor', v_valor_pago,
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$$;


-- == 2. ATUALIZAR `estornar_mensalidade` ==

CREATE OR REPLACE FUNCTION public.estornar_mensalidade(
  p_mensalidade_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_m public.mensalidades%ROWTYPE;
  v_valor numeric(14,2);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas mensalidades pagas podem ser estornadas');
  END IF;

  v_valor := COALESCE(v_m.valor_pago_total, v_m.valor_previsto, 0);

  -- A tabela `financeiro_estornos` já serve como um log específico, mas o `audit_logs` é o principal.
  INSERT INTO public.financeiro_estornos (
    escola_id, mensalidade_id, valor, motivo, created_by
  ) VALUES (
    v_m.escola_id, v_m.id, v_valor, NULLIF(btrim(p_motivo), ''), v_user_id
  );

  UPDATE public.mensalidades
  SET
    status = 'pendente',
    valor_pago_total = 0,
    data_pagamento_efetiva = NULL,
    metodo_pagamento = NULL,
    observacao = CASE
      WHEN COALESCE(btrim(p_motivo), '') = '' THEN
        COALESCE(observacao, '') || ' [ESTORNO]'
      ELSE
        COALESCE(observacao, '') || ' [ESTORNO] ' || btrim(p_motivo)
    END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_m.id;

  -- Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    v_m.escola_id,
    v_user_id,
    'PAGAMENTO_ESTORNADO',
    'mensalidades',
    p_mensalidade_id::text,
    'financeiro',
    jsonb_build_object(
        'motivo', p_motivo,
        'valor_estornado', v_valor
    ),
    jsonb_build_object('status', 'pago'),
    jsonb_build_object('status', 'pendente')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidade_id', v_m.id,
    'valor_estornado', v_valor
  );
END;
$$;

COMMIT;
