BEGIN;

CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamentos(
  p_mensalidade_ids uuid[],
  p_evidence_url text,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_lote_id uuid := gen_random_uuid();
  v_result jsonb;
  v_pagamento_ids uuid[] := ARRAY[]::uuid[];
  v_total numeric(14,2) := 0;
BEGIN
  SELECT array_agg(DISTINCT id ORDER BY id)
    INTO v_ids
  FROM unnest(COALESCE(p_mensalidade_ids, ARRAY[]::uuid[])) AS ids(id)
  WHERE id IS NOT NULL;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'DATA: seleccione pelo menos uma mensalidade';
  END IF;
  IF array_length(v_ids, 1) > 24 THEN
    RAISE EXCEPTION 'DATA: máximo de 24 mensalidades por comprovativo';
  END IF;

  -- As chamadas abaixo participam da mesma transacção. Qualquer falha reverte
  -- todas as alocações e evita comprovativos parcialmente registados.
  FOREACH v_id IN ARRAY v_ids LOOP
    v_result := public.aluno_submeter_comprovativo_pagamento(
      v_id,
      p_evidence_url,
      NULL,
      COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
        'lote_id', v_lote_id,
        'lote_quantidade', array_length(v_ids, 1),
        'lote_mensalidade_ids', to_jsonb(v_ids),
        'origem', 'portal_aluno_comprovativo_consolidado'
      ),
      p_mensagem
    );
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'DATA: falha ao registar mensalidade %', v_id;
    END IF;
    v_pagamento_ids := array_append(v_pagamento_ids, (v_result->>'pagamento_id')::uuid);
    v_total := v_total + COALESCE((v_result->>'valor_enviado')::numeric, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'lote_id', v_lote_id,
    'pagamento_ids', to_jsonb(v_pagamento_ids),
    'mensalidade_ids', to_jsonb(v_ids),
    'quantidade', array_length(v_ids, 1),
    'valor_total', v_total,
    'status', 'pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_lote_pagamentos(
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
  v_lote_id text;
  v_item record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  SELECT NULLIF(meta->>'lote_id', '')
    INTO v_lote_id
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  FOR v_item IN
    SELECT id
    FROM public.pagamentos
    WHERE id = p_pagamento_id
       OR (v_lote_id IS NOT NULL AND meta->>'lote_id' = v_lote_id)
    ORDER BY id
    FOR UPDATE
  LOOP
    v_result := public.validar_pagamento(v_item.id, p_aprovado, p_mensagem_secretaria);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'DATA: falha ao validar item %', v_item.id;
    END IF;
    v_results := v_results || jsonb_build_array(v_result);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'lote_id', v_lote_id,
    'quantidade', v_count,
    'aprovado', p_aprovado,
    'resultados', v_results
  );
END;
$$;

ALTER FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(uuid[], text, jsonb, text) TO service_role;

ALTER FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) TO service_role;

COMMIT;
