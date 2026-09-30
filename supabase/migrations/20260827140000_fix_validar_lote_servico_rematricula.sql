-- A fila unificada também contém pagamento_intents de serviços/rematrículas.
-- O wrapper antigo só procurava em pagamentos (mensalidades), causando
-- "Pagamento não encontrado" ao aprovar comprovativos do portal do aluno.
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
  IF EXISTS (SELECT 1 FROM public.pagamentos WHERE id = p_pagamento_id) THEN
    SELECT NULLIF(meta->>'lote_id', '') INTO v_lote_id
    FROM public.pagamentos WHERE id = p_pagamento_id FOR UPDATE;

    FOR v_item IN
      SELECT id FROM public.pagamentos
      WHERE id = p_pagamento_id
         OR (v_lote_id IS NOT NULL AND meta->>'lote_id' = v_lote_id)
      ORDER BY id FOR UPDATE
    LOOP
      v_result := public.validar_pagamento(v_item.id, p_aprovado, p_mensagem_secretaria);
      IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'DATA: falha ao validar item %', v_item.id;
      END IF;
      v_results := v_results || jsonb_build_array(v_result);
      v_count := v_count + 1;
    END LOOP;
  ELSIF EXISTS (SELECT 1 FROM public.pagamento_intents WHERE id = p_pagamento_id) THEN
    -- Serviços e rematrículas são intenções, mas partilham a mesma decisão
    -- de secretaria e a mesma função canónica de validação.
    v_result := public.validar_pagamento(p_pagamento_id, p_aprovado, p_mensagem_secretaria);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'DATA: falha ao validar intenção %', p_pagamento_id;
    END IF;
    v_results := jsonb_build_array(v_result);
    v_count := 1;
  ELSE
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lote_id', v_lote_id,
    'quantidade', v_count,
    'aprovado', p_aprovado,
    'resultados', v_results
  );
END;
$$;

ALTER FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_lote_pagamentos(uuid, boolean, text) TO service_role;
