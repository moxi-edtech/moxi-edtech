-- Add trend data to affiliate portal RPC
BEGIN;

CREATE OR REPLACE FUNCTION public.get_afiliado_portal(p_codigo text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_materiais jsonb;
  v_result jsonb;
  v_trend jsonb;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  SELECT codigo, nome, materiais_json
    INTO v_codigo, v_nome, v_materiais
  FROM public.afiliados
  WHERE codigo = v_codigo
    AND ativo = true
    AND pin_hash = crypt(coalesce(p_pin, ''), pin_hash)
  LIMIT 1;

  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  -- Gerar tendência dos últimos 7 dias
  WITH dias AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS dia
  ),
  counts AS (
    SELECT 
      created_at::date as dia,
      count(*) as total
    FROM public.marketing_leads
    WHERE upper(afiliado_codigo) = v_codigo
      AND created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'dia', to_char(d.dia, 'DD/MM'),
      'total', coalesce(c.total, 0)
    )
    ORDER BY d.dia ASC
  ) INTO v_trend
  FROM dias d
  LEFT JOIN counts c ON d.dia = c.dia;

  SELECT jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', count(*),
      'novos', count(*) FILTER (WHERE status = 'NOVO'),
      'em_contacto', count(*) FILTER (WHERE status = 'EM_CONTACTO'),
      'convertidos', count(*) FILTER (WHERE status = 'CONVERTIDO'),
      'trend', coalesce(v_trend, '[]'::jsonb),
      'leads', coalesce((
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
          FROM public.marketing_leads
          WHERE upper(afiliado_codigo) = v_codigo
          ORDER BY created_at DESC
          LIMIT 50
        ) sub
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM public.marketing_leads
  WHERE upper(afiliado_codigo) = v_codigo;

  RETURN coalesce(v_result, jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', 0,
      'novos', 0,
      'em_contacto', 0,
      'convertidos', 0,
      'trend', coalesce(v_trend, '[]'::jsonb),
      'leads', '[]'::jsonb
    )
  ));
END;
$$;

COMMIT;
