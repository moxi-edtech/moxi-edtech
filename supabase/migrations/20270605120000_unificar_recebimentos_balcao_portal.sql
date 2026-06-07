-- Unificação da Visão de Pagamentos Pendentes para incluir Serviços (Balcão/Self-Service)
DROP VIEW IF EXISTS public.vw_pagamentos_pendentes;

CREATE OR REPLACE VIEW public.vw_pagamentos_pendentes
WITH (security_invoker = true) AS
SELECT
  p.id AS pagamento_id,
  p.escola_id,
  m.id AS mensalidade_id,
  m.aluno_id,
  COALESCE(a.nome_completo, a.nome) AS aluno_nome,
  COALESCE(t.turma_codigo, t.turma_code, t.nome) AS turma_codigo,
  CAST(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0) AS numeric(14,2)) AS valor_esperado,
  CAST(p.valor_pago AS numeric(14,2)) AS valor_enviado,
  p.evidence_url AS comprovante_url,
  p.reference,
  p.metodo,
  p.created_at,
  p.meta -> 'comprovativo' ->> 'mensagem_aluno' AS mensagem_aluno,
  'mensalidade' as tipo_entidade,
  null as servico_codigo,
  'Mensalidade Escolar' as servico_nome
FROM public.pagamentos p
JOIN public.mensalidades m ON m.id = p.mensalidade_id
JOIN public.alunos a ON a.id = m.aluno_id
LEFT JOIN public.matriculas mat ON mat.id = m.matricula_id
LEFT JOIN public.turmas t ON t.id = COALESCE(m.turma_id, mat.turma_id)
WHERE p.status = 'pending'

UNION ALL

SELECT
  pi.id AS pagamento_id,
  pi.escola_id,
  null AS mensalidade_id,
  pi.aluno_id,
  COALESCE(a.nome_completo, a.nome) AS aluno_nome,
  COALESCE(t.turma_codigo, t.turma_code, t.nome) AS turma_codigo,
  CAST(pi.amount AS numeric(14,2)) AS valor_esperado,
  CAST(pi.amount AS numeric(14,2)) AS valor_enviado,
  pi.evidence_url AS comprovante_url,
  pi.reference,
  pi.method AS metodo,
  pi.created_at,
  pi.meta ->> 'mensagem_aluno' AS mensagem_aluno,
  'servico' as tipo_entidade,
  sp.servico_codigo,
  sp.servico_nome
FROM public.pagamento_intents pi
JOIN public.alunos a ON a.id = pi.aluno_id
JOIN public.servico_pedidos sp ON sp.id = pi.servico_pedido_id
LEFT JOIN public.matriculas mat ON mat.aluno_id = a.id AND mat.escola_id = pi.escola_id AND mat.status = 'ativo'
LEFT JOIN public.turmas t ON t.id = mat.turma_id
WHERE pi.status = 'pending';

-- RPC de Validação Unificada
CREATE OR REPLACE FUNCTION public.validar_pagamento(
  p_pagamento_id uuid,
  p_aprovado boolean,
  p_mensagem_secretaria text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  -- Para Mensalidade
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_recibo jsonb := '{}'::jsonb;
  v_valor_esperado numeric(14,2);
  v_valor_pago_atual numeric(14,2);
  v_novo_valor_pago numeric(14,2);
  -- Para Serviço
  v_intent public.pagamento_intents%ROWTYPE;
BEGIN
  -- 1. Validação Básica
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated_or_tenant_not_resolved';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'financeiro', 'secretaria_financeiro', 'admin_financeiro', 'admin_escola', 'admin', 'staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  -- 2. Identificar se é Pagamento (Mensalidade) ou Intent (Serviço)
  SELECT * INTO v_pagamento FROM public.pagamentos WHERE id = p_pagamento_id FOR UPDATE;
  
  IF v_pagamento.id IS NOT NULL THEN
    -- ==========================================
    -- LÓGICA MENSALIDADE
    -- ==========================================
    IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
    END IF;

    IF v_pagamento.mensalidade_id IS NULL THEN
      RAISE EXCEPTION 'DATA: pagamento sem mensalidade associada';
    END IF;

    SELECT * INTO v_mensalidade FROM public.mensalidades WHERE id = v_pagamento.mensalidade_id FOR UPDATE;

    IF NOT p_aprovado THEN
      IF COALESCE(NULLIF(trim(p_mensagem_secretaria), ''), '') = '' THEN
        RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
      END IF;
      
      UPDATE public.pagamentos
      SET status = 'rejected',
          updated_at = now(),
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
              'validacao', jsonb_build_object('aprovado', false, 'validator_user_id', v_actor_id, 'validated_at', now(), 'mensagem_secretaria', p_mensagem_secretaria)
          )
      WHERE id = p_pagamento_id;
      
      RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'pagamento_id', p_pagamento_id);
    END IF;

    -- Aprovar Mensalidade
    IF COALESCE(v_pagamento.valor_pago, 0) <= 0 THEN
      RAISE EXCEPTION 'DATA: valor do pagamento inválido';
    END IF;

    v_valor_esperado := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
    v_valor_pago_atual := COALESCE(v_mensalidade.valor_pago_total, 0);
    v_novo_valor_pago := v_valor_pago_atual + COALESCE(v_pagamento.valor_pago, 0);

    UPDATE public.pagamentos
    SET status = 'settled',
        settled_at = now(),
        settled_by = v_actor_id,
        updated_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'validacao', jsonb_build_object('aprovado', true, 'validator_user_id', v_actor_id, 'validated_at', now())
        )
    WHERE id = p_pagamento_id;

    UPDATE public.mensalidades
    SET status = CASE WHEN v_novo_valor_pago >= v_valor_esperado THEN 'pago' ELSE 'pago_parcial' END,
        valor_pago_total = v_novo_valor_pago,
        data_pagamento_efetiva = COALESCE(data_pagamento_efetiva, now()::date),
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = v_mensalidade.id;

    IF v_novo_valor_pago >= v_valor_esperado THEN
      v_recibo := public.emitir_recibo(v_mensalidade.id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 
        'status', CASE WHEN v_novo_valor_pago >= v_valor_esperado THEN 'approved' ELSE 'approved_parcial' END, 
        'pagamento_id', p_pagamento_id,
        'recibo', v_recibo
    );

  ELSE
    -- ==========================================
    -- LÓGICA SERVIÇO (Balcão/Self-Service)
    -- ==========================================
    SELECT * INTO v_intent FROM public.pagamento_intents WHERE id = p_pagamento_id FOR UPDATE;
    
    IF v_intent.id IS NULL THEN
      RAISE EXCEPTION 'DATA: Pagamento não encontrado.';
    END IF;

    IF v_intent.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
    END IF;

    IF NOT p_aprovado THEN
      IF COALESCE(NULLIF(trim(p_mensagem_secretaria), ''), '') = '' THEN
        RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
      END IF;

      UPDATE public.pagamento_intents 
      SET status = 'failed', 
          meta = meta || jsonb_build_object('reject_reason', p_mensagem_secretaria, 'validated_at', now(), 'validator_user_id', v_actor_id) 
      WHERE id = p_pagamento_id;
      
      UPDATE public.servico_pedidos SET status = 'canceled' WHERE id = v_intent.servico_pedido_id;
      
      RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'pagamento_id', p_pagamento_id);
    END IF;

    -- Aprovar Serviço
    UPDATE public.pagamento_intents 
    SET status = 'settled', 
        settled_at = now(),
        meta = meta || jsonb_build_object('confirmed_via', 'portal_validacao_recebimentos', 'validated_at', now(), 'validator_user_id', v_actor_id)
    WHERE id = p_pagamento_id;

    UPDATE public.servico_pedidos 
    SET status = 'granted' 
    WHERE id = v_intent.servico_pedido_id;

    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'pagamento_id', p_pagamento_id);
  END IF;
END;
$$;
