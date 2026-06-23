BEGIN;

CREATE OR REPLACE FUNCTION public.get_afiliado_portal(p_codigo text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_materiais jsonb;
  v_result jsonb;
  v_trend jsonb;
  v_onboarding jsonb;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  SELECT a.codigo, a.nome, a.materiais_json
    INTO v_codigo, v_nome, v_materiais
  FROM public.afiliados a
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND a.pin_hash = extensions.crypt(coalesce(p_pin, ''), a.pin_hash)
  LIMIT 1;

  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  WITH dias AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS dia
  ),
  counts AS (
    SELECT
      ml.created_at::date AS dia,
      count(*) AS total
    FROM public.marketing_leads ml
    WHERE upper(ml.afiliado_codigo) = v_codigo
      AND ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
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
    'total', count(*),
    'pendentes', count(*) FILTER (WHERE obr.status = 'pendente'),
    'em_configuracao', count(*) FILTER (WHERE obr.status = 'em_configuracao'),
    'fechadas', count(*) FILTER (WHERE obr.status = 'activo'),
    'escolas', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'data', recent.created_at,
          'status', recent.status,
          'escola', recent.escola_nome,
          'plano', recent.financeiro->>'plano_interesse',
          'plano_label', recent.financeiro->>'plano_interesse_label',
          'total_alunos', recent.financeiro->>'total_alunos',
          'token', recent.tracking_token,
          'faixa_propina', recent.faixa_propina,
          'steps', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'code', s.step_code,
                'title', s.title,
                'status', s.status,
                'owner', s.owner_type,
                'deadline', s.deadline_at,
                'completed_at', s.completed_at
              )
              ORDER BY s.created_at ASC
            )
            FROM public.onboarding_steps s
            WHERE s.onboarding_id = recent.id
          ), '[]'::jsonb)
        )
        ORDER BY recent.created_at DESC
      )
      FROM (
        SELECT
          id,
          created_at,
          status,
          escola_nome,
          financeiro,
          tracking_token,
          faixa_propina
        FROM public.onboarding_requests
        WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = v_codigo
        ORDER BY created_at DESC
        LIMIT 50
      ) recent
    ), '[]'::jsonb)
  )
  INTO v_onboarding
  FROM public.onboarding_requests obr
  WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = v_codigo;

  SELECT jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', count(*),
      'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
      'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
      'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
      'trend', coalesce(v_trend, '[]'::jsonb),
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0,
        'pendentes', 0,
        'em_configuracao', 0,
        'fechadas', 0,
        'escolas', '[]'::jsonb
      )),
      'leads', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', recent.created_at,
            'status', recent.status,
            'score', recent.score,
            'escola_hint',
              CASE
                WHEN length(recent.escola) > 5 THEN left(recent.escola, 3) || '***' || right(recent.escola, 2)
                ELSE left(recent.escola, 1) || '***'
              END
          )
          ORDER BY recent.created_at DESC
        )
        FROM (
          SELECT created_at, status, score, escola
          FROM public.marketing_leads
          WHERE upper(afiliado_codigo) = v_codigo
          ORDER BY created_at DESC
          LIMIT 50
        ) recent
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM public.marketing_leads ml
  WHERE upper(ml.afiliado_codigo) = v_codigo;

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
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0,
        'pendentes', 0,
        'em_configuracao', 0,
        'fechadas', 0,
        'escolas', '[]'::jsonb
      )),
      'leads', '[]'::jsonb
    )
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_afiliado_portal(text, text) TO anon, authenticated;

COMMIT;
