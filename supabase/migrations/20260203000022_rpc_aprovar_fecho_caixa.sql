BEGIN;

-- =================================================================
-- RPC para Aprovação de Fecho de Caixa
-- =================================================================

CREATE OR REPLACE FUNCTION public.aprovar_fecho_caixa(
  p_fecho_caixa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_fecho record;
  v_has_permission boolean;
  v_totals jsonb;
BEGIN
  -- 1. Buscar o Fecho de Caixa
  SELECT * INTO v_fecho FROM public.fecho_caixa WHERE id = p_fecho_caixa_id FOR UPDATE;
  IF v_fecho.id IS NULL THEN
    RAISE EXCEPTION 'Fecho de caixa não encontrado.';
  END IF;

  -- 2. Validação de Permissões (apenas admin/gerente pode aprovar)
  SELECT public.user_has_role_in_school(v_fecho.escola_id, ARRAY['admin', 'admin_escola', 'financeiro'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para aprovar fecho de caixa.';
  END IF;

  -- 3. Calcular os totais do sistema para o operador e data do fecho
  -- Esta lógica é uma adaptação da função getFechoCaixaData
  SELECT jsonb_build_object(
    'especie', SUM(CASE WHEN m.metodo = 'especie' THEN m.valor ELSE 0 END),
    'tpa', SUM(CASE WHEN m.metodo = 'tpa' THEN m.valor ELSE 0 END),
    'transferencia', SUM(CASE WHEN m.metodo = 'transferencia' THEN m.valor ELSE 0 END)
  )
  INTO v_totals
  FROM (
    SELECT
      l.valor_total as valor,
      CASE
        WHEN lower(l.metodo_pagamento) IN ('numerario', 'dinheiro') THEN 'especie'
        WHEN lower(l.metodo_pagamento) IN ('multicaixa', 'tpa') THEN 'tpa'
        ELSE 'transferencia'
      END as metodo
    FROM public.financeiro_lancamentos l
    WHERE l.escola_id = v_fecho.escola_id
      AND l.created_by = v_fecho.operador_id
      AND l.data_pagamento::date = v_fecho.data_fecho
      AND l.tipo = 'credito'
      AND l.status = 'pago'
  ) m;

  -- 4. Atualizar o registro de fecho de caixa com os valores do sistema e as diferenças
  UPDATE public.fecho_caixa
  SET
    valor_sistema_especie = (v_totals->>'especie')::numeric,
    valor_sistema_tpa = (v_totals->>'tpa')::numeric,
    valor_sistema_transferencia = (v_totals->>'transferencia')::numeric,
    diferenca_especie = valor_declarado_especie - (v_totals->>'especie')::numeric,
    diferenca_tpa = valor_declarado_tpa - (v_totals->>'tpa')::numeric,
    diferenca_transferencia = valor_declarado_transferencia - (v_totals->>'transferencia')::numeric,
    status = 'aprovado',
    aprovado_por = v_actor_id,
    aprovado_em = now(),
    updated_at = now()
  WHERE id = p_fecho_caixa_id;

  -- 5. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_fecho.escola_id,
    v_actor_id,
    'FECHO_CAIXA_APROVADO',
    'fecho_caixa',
    p_fecho_caixa_id::text,
    'admin',
    jsonb_build_object(
      'declarado_especie', v_fecho.valor_declarado_especie,
      'sistema_especie', (v_totals->>'especie')::numeric,
      'diferenca_especie', v_fecho.valor_declarado_especie - (v_totals->>'especie')::numeric
    )
  );

  RETURN jsonb_build_object('ok', true, 'fecho_id', p_fecho_caixa_id);
END;
$$;

ALTER FUNCTION public.aprovar_fecho_caixa(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.aprovar_fecho_caixa(uuid) TO authenticated;

COMMIT;
