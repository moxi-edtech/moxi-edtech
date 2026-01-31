BEGIN;

-- =================================================================
-- RPC para Declaração de Fecho de Caixa Cego
-- =================================================================

CREATE OR REPLACE FUNCTION public.declarar_fecho_caixa(
  p_escola_id uuid,
  p_valor_declarado_especie numeric,
  p_valor_declarado_tpa numeric,
  p_valor_declarado_transferencia numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_fecho_id uuid;
BEGIN
  -- 1. Inserir a declaração cega.
  -- A chave única uq_fecho_caixa_operador_dia impede múltiplas declarações.
  INSERT INTO public.fecho_caixa (
    escola_id,
    operador_id,
    data_fecho,
    valor_declarado_especie,
    valor_declarado_tpa,
    valor_declarado_transferencia,
    status
  )
  VALUES (
    p_escola_id,
    v_actor_id,
    current_date,
    p_valor_declarado_especie,
    p_valor_declarado_tpa,
    p_valor_declarado_transferencia,
    'declarado'
  )
  ON CONFLICT (escola_id, operador_id, data_fecho) DO UPDATE SET
    valor_declarado_especie = EXCLUDED.valor_declarado_especie,
    valor_declarado_tpa = EXCLUDED.valor_declarado_tpa,
    valor_declarado_transferencia = EXCLUDED.valor_declarado_transferencia,
    updated_at = now()
  RETURNING id INTO v_fecho_id;
  
  -- 2. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'FECHO_CAIXA_DECLARADO',
    'fecho_caixa',
    v_fecho_id::text,
    'financeiro',
    jsonb_build_object(
      'declarado_especie', p_valor_declarado_especie,
      'declarado_tpa', p_valor_declarado_tpa,
      'declarado_transferencia', p_valor_declarado_transferencia
    )
  );

  RETURN jsonb_build_object('ok', true, 'fecho_id', v_fecho_id);
END;
$$;

ALTER FUNCTION public.declarar_fecho_caixa(uuid, numeric, numeric, numeric) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.declarar_fecho_caixa(uuid, numeric, numeric, numeric) TO authenticated;

COMMIT;
