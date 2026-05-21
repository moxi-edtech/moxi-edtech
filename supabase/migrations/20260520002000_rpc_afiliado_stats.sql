-- Function to get obscured stats for affiliates
CREATE OR REPLACE FUNCTION public.get_afiliado_stats(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Normalizar o código para maiúsculas
  p_codigo := upper(p_codigo);

  SELECT jsonb_build_object(
    'total_diagnosticos', count(*),
    'novos', count(*) FILTER (WHERE status = 'NOVO'),
    'em_contacto', count(*) FILTER (WHERE status = 'EM_CONTACTO'),
    'convertidos', count(*) FILTER (WHERE status = 'CONVERTIDO'),
    'leads', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'data', created_at,
          'status', status,
          'score', score,
          'escola_hint', 
            CASE 
              WHEN length(escola) > 5 THEN left(escola, 3) || '***' || right(escola, 2)
              ELSE left(escola, 1) || '***'
            END
        )
      )
      FROM (
        SELECT created_at, status, score, escola
        FROM marketing_leads
        WHERE upper(afiliado_codigo) = p_codigo
        ORDER BY created_at DESC
        LIMIT 50
      ) sub
    ), '[]'::jsonb)
  ) INTO v_result
  FROM marketing_leads
  WHERE upper(afiliado_codigo) = p_codigo;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_diagnosticos', 0,
    'novos', 0,
    'em_contacto', 0,
    'convertidos', 0,
    'leads', '[]'::jsonb
  ));
END;
$$;

-- Liberar execução para qualquer pessoa (a função protege os dados reais)
GRANT EXECUTE ON FUNCTION public.get_afiliado_stats(text) TO anon, authenticated;
