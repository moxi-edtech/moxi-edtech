-- Migration: Update get_afiliado_member_portal RPC to include director contacts, call logs timeline, and uploads list
-- Created at: 2026-06-23

CREATE OR REPLACE FUNCTION public.get_afiliado_member_portal(
  p_codigo text,
  p_member_id uuid,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_materiais jsonb;
  v_member_nome text;
  v_result jsonb;
  v_trend jsonb;
  v_onboarding jsonb;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  SELECT
    a.codigo,
    a.nome,
    a.materiais_json,
    m.nome
    INTO v_codigo, v_nome, v_materiais, v_member_nome
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.id = p_member_id
    AND m.ativo = true
    AND m.pin_hash = extensions.crypt(coalesce(p_pin, ''), m.pin_hash)
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
          'escola_tel', recent.escola_tel,
          'escola_email', recent.escola_email,
          'director_nome', recent.director_nome,
          'director_tel', recent.director_tel,
          'escola_morada', recent.morada,
          'escola_municipio', recent.escola_municipio,
          'escola_provincia', recent.escola_provincia,
          'escola_nif', recent.escola_nif,
          'calls', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', al.id,
                'realizado_em', al.details->>'realizado_em',
                'member_name', al.details->>'member_name',
                'step_title', al.details->>'step_title',
                'notes', al.details->>'notes'
              )
              ORDER BY al.created_at DESC
            )
            FROM public.audit_logs al
            WHERE al.portal = 'influencer_portal'
              AND al.acao = 'PARTNER_CALL_FOLLOWUP'
              AND al.registro_id = recent.id::text
          ), '[]'::jsonb),
          'uploads', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', up.id,
                'step_code', up.step_code,
                'file_path', up.file_path,
                'status', up.status,
                'rejection_reason', up.rejection_reason,
                'created_by', up.created_by,
                'created_at', up.created_at
              )
              ORDER BY up.created_at DESC
            )
            FROM public.onboarding_uploads up
            WHERE up.onboarding_id = recent.id
          ), '[]'::jsonb),
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
              ORDER BY coalesce(array_position(ARRAY['diagnostico', 'docs_legais', 'planilhas', 'validacao', 'config', 'treinamento', 'live']::text[], s.step_code), 999), s.created_at ASC
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
          faixa_propina,
          escola_tel,
          escola_email,
          director_nome,
          director_tel,
          escola_morada AS morada,
          escola_municipio,
          escola_provincia,
          escola_nif
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
    'member', jsonb_build_object(
      'id', p_member_id,
      'name', v_member_nome
    ),
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
    'member', jsonb_build_object(
      'id', p_member_id,
      'name', v_member_nome
    ),
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
