BEGIN;

INSERT INTO public.afiliado_membros (
  afiliado_id,
  nome,
  pin_hash,
  ativo,
  created_at,
  updated_at
)
SELECT
  a.id,
  coalesce(nullif(btrim(a.nome), ''), a.codigo),
  a.pin_hash,
  a.ativo,
  a.created_at,
  a.updated_at
FROM public.afiliados a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.afiliado_membros m
  WHERE m.afiliado_id = a.id
);

CREATE OR REPLACE FUNCTION public.create_afiliado_admin(
  p_nome TEXT,
  p_codigo TEXT,
  p_email TEXT,
  p_pin TEXT
)
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  nome TEXT,
  email TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_nome TEXT := nullif(trim(coalesce(p_nome, '')), '');
  v_codigo TEXT := upper(trim(coalesce(p_codigo, '')));
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_pin TEXT := trim(coalesce(p_pin, ''));
  v_new_id UUID;
  v_pin_hash TEXT;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'invalid_nome'
      USING ERRCODE = '22023';
  END IF;

  IF v_codigo = '' THEN
    RAISE EXCEPTION 'invalid_codigo'
      USING ERRCODE = '22023';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'invalid_email'
      USING ERRCODE = '22023';
  END IF;

  IF v_pin = '' OR length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin'
      USING ERRCODE = '22023';
  END IF;

  v_pin_hash := extensions.crypt(v_pin, extensions.gen_salt('bf'));

  INSERT INTO public.afiliados (
    nome,
    codigo,
    email,
    pin_hash
  )
  VALUES (
    v_nome,
    v_codigo,
    v_email,
    v_pin_hash
  )
  RETURNING afiliados.id INTO v_new_id;

  INSERT INTO public.afiliado_membros (
    afiliado_id,
    nome,
    pin_hash,
    ativo
  )
  VALUES (
    v_new_id,
    v_nome,
    v_pin_hash,
    true
  );

  INSERT INTO public.audit_logs (
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    'super_admin',
    'AFILIADO_CRIADO',
    'afiliado',
    v_new_id::text,
    jsonb_build_object(
      'nome', v_nome,
      'codigo', v_codigo,
      'email', v_email,
      'member_seeded', true
    )
  );

  RETURN QUERY
  SELECT
    a.id,
    a.codigo,
    a.nome,
    a.email,
    a.ativo,
    a.created_at
  FROM public.afiliados a
  WHERE a.id = v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_afiliado_membros_public(p_codigo text)
RETURNS TABLE (
  afiliado_id uuid,
  afiliado_codigo text,
  afiliado_nome text,
  membro_id uuid,
  membro_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
BEGIN
  IF v_codigo = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS afiliado_id,
    a.codigo AS afiliado_codigo,
    coalesce(nullif(btrim(a.nome), ''), a.codigo) AS afiliado_nome,
    m.id AS membro_id,
    m.nome AS membro_nome
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.ativo = true
  ORDER BY lower(m.nome) ASC, m.id ASC;
END;
$$;

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
              ORDER BY coalesce(array_position(ARRAY['nif', 'planilha_alunos', 'treinamento', 'ativacao']::text[], s.step_code), 999), s.created_at ASC
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

CREATE OR REPLACE FUNCTION public.list_influencer_members_public(p_codigo text)
RETURNS TABLE (
  afiliado_id uuid,
  afiliado_codigo text,
  afiliado_nome text,
  membro_id uuid,
  membro_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.list_afiliado_membros_public(p_codigo);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_influencer_member_portal(
  p_codigo text,
  p_member_id uuid,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
BEGIN
  RETURN public.get_afiliado_member_portal(p_codigo, p_member_id, p_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_afiliado_membros_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_afiliado_member_portal(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_influencer_members_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal(text, uuid, text) TO anon, authenticated;

COMMIT;
