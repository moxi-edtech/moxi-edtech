ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Função para registrar pagamento integral de uma mensalidade
CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_mensalidade_id uuid,
  p_metodo_pagamento text,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
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

  UPDATE public.mensalidades
  SET
    status = 'pago',
    valor_pago_total = COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor),
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = p_observacao,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor', COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor),
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pagamento(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento(uuid, text, text) TO service_role;
