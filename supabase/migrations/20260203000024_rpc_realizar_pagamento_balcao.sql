BEGIN;

-- =================================================================
-- RPC para Realizar Pagamento no Balcão (Checkout Atômico e Auditado)
--
-- OBJETIVO:
-- 1. Processar múltiplos itens de um carrinho (mensalidades e serviços)
--    em uma única transação atômica.
-- 2. Registrar os pagamentos e lançamentos financeiro de forma auditada.
-- 3. Calcular e retornar o troco.
-- =================================================================

CREATE OR REPLACE FUNCTION public.realizar_pagamento_balcao(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_carrinho_itens jsonb, -- Array de {id: string, tipo: 'mensalidade'|'servico', preco: number}
  p_metodo_pagamento text,
  p_valor_recebido numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_aluno_matricula_id uuid;
  v_total_a_pagar numeric := 0;
  v_troco numeric := 0;
  v_mensalidade_id uuid;
  v_servico_id uuid;
  v_servico_nome text;
  v_preco_item numeric;
  item_do_carrinho jsonb;
  v_lancamentos_ids uuid[] := '{}';
  v_mensalidades_pagas_ids uuid[] := '{}';
BEGIN
  -- 1. Validação de Permissões (Secretaria ou Admin)
  SELECT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para operar o balcão.';
  END IF;

  -- 2. Obter a matrícula ativa do aluno
  SELECT id INTO v_aluno_matricula_id
  FROM public.matriculas
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND status = 'ativa'
  LIMIT 1;
  
  IF v_aluno_matricula_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Aluno não possui matrícula ativa nesta escola.';
  END IF;

  -- 3. Calcular o total a pagar e processar itens do carrinho
  FOR item_do_carrinho IN SELECT * FROM jsonb_array_elements(p_carrinho_itens) LOOP
    v_preco_item := (item_do_carrinho->>'preco')::numeric;
    v_total_a_pagar := v_total_a_pagar + v_preco_item;

    IF (item_do_carrinho->>'tipo')::text = 'mensalidade' THEN
      v_mensalidade_id := (item_do_carrinho->>'id')::uuid;
      
      -- Chama a lógica de registro de pagamento (já auditada internamente)
      -- Adaptação da RPC registrar_pagamento para ser chamada internamente
      PERFORM public.registrar_pagamento(v_mensalidade_id, p_metodo_pagamento, 'Pagamento via balcão');
      v_mensalidades_pagas_ids := array_append(v_mensalidades_pagas_ids, v_mensalidade_id);

    ELSIF (item_do_carrinho->>'tipo')::text = 'servico' THEN
      v_servico_id := (item_do_carrinho->>'id')::uuid;
      v_servico_nome := (SELECT nome FROM public.servicos_catalogo WHERE id = v_servico_id);

      -- Criar lançamento financeiro para o serviço
      INSERT INTO public.financeiro_lancamentos (
        escola_id,
        aluno_id,
        matricula_id,
        tipo,
        origem,
        descricao,
        valor_original,
        data_pagamento,
        metodo_pagamento,
        created_by,
        status
      ) VALUES (
        p_escola_id,
        p_aluno_id,
        v_aluno_matricula_id,
        'credito', -- Sempre um crédito para a escola
        'servico_balcao',
        'Pagamento de serviço: ' || v_servico_nome,
        v_preco_item,
        NOW(),
        p_metodo_pagamento,
        v_actor_id,
        'pago'
      ) RETURNING id INTO v_lancamento_id;
      v_lancamentos_ids := array_append(v_lancamentos_ids, v_lancamento_id);

    ELSE
      RAISE EXCEPTION 'ITEM: Tipo de item desconhecido no carrinho: %', (item_do_carrinho->>'tipo')::text;
    END IF;
  END LOOP;

  -- 4. Validação do Pagamento e Cálculo do Troco
  IF p_metodo_pagamento = 'numerario' THEN
    IF p_valor_recebido < v_total_a_pagar THEN
      RAISE EXCEPTION 'PAYMENT: Valor recebido (Numerário) é insuficiente.';
    END IF;
    v_troco := p_valor_recebido - v_total_a_pagar;
  ELSE -- TPA ou Transferência: Assume-se que o valor recebido é exatamente o total a pagar
    IF p_valor_recebido < v_total_a_pagar THEN -- Validar se o valor recebido é ao menos o total
        RAISE EXCEPTION 'PAYMENT: Valor recebido é insuficiente para o método de pagamento %', p_metodo_pagamento;
    END IF;
    v_troco := 0; -- Não há troco para TPA/Transferência
  END IF;

  -- 5. Auditoria da Transação Completa do Balcão
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'BALCAO_PAGAMENTO_COMPLETO',
    'aluno', -- Entidade principal é o aluno que está sendo atendido
    p_aluno_id::text,
    'secretaria',
    jsonb_build_object(
      'itens_processados', p_carrinho_itens,
      'total_a_pagar', v_total_a_pagar,
      'metodo_pagamento', p_metodo_pagamento,
      'valor_recebido', p_valor_recebido,
      'troco', v_troco,
      'mensalidades_pagas_ids', v_mensalidades_pagas_ids,
      'lancamentos_servicos_ids', v_lancamentos_ids
    )
  );

  RETURN jsonb_build_object('ok', true, 'troco', v_troco, 'total_pago', v_total_a_pagar, 'mensalidades_pagas', jsonb_array_length(to_jsonb(v_mensalidades_pagas_ids)), 'servicos_pagos', jsonb_array_length(to_jsonb(v_lancamentos_ids)));
END;
$$;

ALTER FUNCTION public.realizar_pagamento_balcao(uuid, uuid, jsonb, text, numeric) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.realizar_pagamento_balcao(uuid, uuid, jsonb, text, numeric) TO authenticated;

COMMIT;
