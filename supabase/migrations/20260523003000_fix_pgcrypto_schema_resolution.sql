-- Fix pgcrypto function resolution by using explicit schema scoping
BEGIN;

-- 1. Update create_afiliado_admin to use extensions schema for pgcrypto functions
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
SET search_path = public, extensions
AS $$
DECLARE
  v_nome TEXT := nullif(trim(coalesce(p_nome, '')), '');
  v_codigo TEXT := upper(trim(coalesce(p_codigo, '')));
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_pin TEXT := trim(coalesce(p_pin, ''));
  v_new_id UUID;
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
    extensions.crypt(v_pin, extensions.gen_salt('bf'))
  )
  RETURNING afiliados.id INTO v_new_id;

  -- Log do evento
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
      'email', v_email
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

-- 2. Also update get_afiliado_portal for consistency
CREATE OR REPLACE FUNCTION public.get_afiliado_portal(p_codigo text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
    AND pin_hash = extensions.crypt(coalesce(p_pin, ''), pin_hash)
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
