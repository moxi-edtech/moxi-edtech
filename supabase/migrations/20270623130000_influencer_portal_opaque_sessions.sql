BEGIN;

CREATE TABLE IF NOT EXISTS public.influencer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_codigo text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.afiliado_membros(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influencer_portal_sessions_codigo_not_blank CHECK (length(btrim(afiliado_codigo)) >= 1),
  CONSTRAINT influencer_portal_sessions_member_name_not_blank CHECK (length(btrim(member_name)) >= 1)
);

CREATE INDEX IF NOT EXISTS ix_influencer_portal_sessions_codigo
  ON public.influencer_portal_sessions (afiliado_codigo);

CREATE INDEX IF NOT EXISTS ix_influencer_portal_sessions_member_id
  ON public.influencer_portal_sessions (member_id);

CREATE INDEX IF NOT EXISTS ix_influencer_portal_sessions_expires_at
  ON public.influencer_portal_sessions (expires_at);

ALTER TABLE public.influencer_portal_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.influencer_portal_sessions FROM PUBLIC;
REVOKE ALL ON public.influencer_portal_sessions FROM anon;
REVOKE ALL ON public.influencer_portal_sessions FROM authenticated;

DROP POLICY IF EXISTS "No direct access to influencer sessions" ON public.influencer_portal_sessions;
CREATE POLICY "No direct access to influencer sessions"
  ON public.influencer_portal_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_influencer_portal_sessions_set_updated_at ON public.influencer_portal_sessions;
CREATE TRIGGER trg_influencer_portal_sessions_set_updated_at
  BEFORE UPDATE ON public.influencer_portal_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_influencer_portal_session(
  p_codigo text,
  p_member_id uuid,
  p_pin text,
  p_ttl_minutes integer DEFAULT 480
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_member_id uuid := p_member_id;
  v_member_name text;
  v_session_id uuid;
  v_ttl_minutes integer := greatest(coalesce(p_ttl_minutes, 480), 5);
BEGIN
  DELETE FROM public.influencer_portal_sessions
  WHERE expires_at <= now();

  SELECT m.nome
    INTO v_member_name
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.id = v_member_id
    AND m.ativo = true
    AND m.pin_hash = extensions.crypt(coalesce(p_pin, ''), m.pin_hash)
  LIMIT 1;

  IF v_member_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  INSERT INTO public.influencer_portal_sessions (
    afiliado_codigo,
    member_id,
    member_name,
    expires_at
  )
  VALUES (
    v_codigo,
    v_member_id,
    v_member_name,
    now() + make_interval(mins => v_ttl_minutes)
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'codigo', v_codigo,
    'member', jsonb_build_object(
      'id', v_member_id,
      'name', v_member_name
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_influencer_portal_session(
  p_session_id uuid,
  p_codigo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo_filter text := upper(trim(coalesce(p_codigo, '')));
  v_session record;
BEGIN
  DELETE FROM public.influencer_portal_sessions
  WHERE expires_at <= now();

  SELECT
    s.id,
    s.afiliado_codigo,
    s.member_id,
    s.member_name,
    s.expires_at
    INTO v_session
  FROM public.influencer_portal_sessions s
  JOIN public.afiliado_membros m
    ON m.id = s.member_id
  JOIN public.afiliados a
    ON a.id = m.afiliado_id
  WHERE s.id = p_session_id
    AND (v_codigo_filter = '' OR s.afiliado_codigo = v_codigo_filter)
    AND a.codigo = s.afiliado_codigo
    AND a.ativo = true
    AND m.ativo = true
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  UPDATE public.influencer_portal_sessions
  SET
    last_seen_at = now(),
    updated_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', v_session.id,
      'codigo', v_session.afiliado_codigo,
      'member_id', v_session.member_id,
      'member_name', v_session.member_name,
      'expires_at', v_session.expires_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_influencer_portal_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  DELETE FROM public.influencer_portal_sessions
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_influencer_portal_session(text, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_portal_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_influencer_portal_session(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_influencer_member_portal_by_session(
  p_session_id uuid,
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);

  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  RETURN (
    WITH session_row AS (
      SELECT
        (v_session->'session'->>'codigo')::text AS codigo,
        (v_session->'session'->>'member_id')::uuid AS member_id,
        (v_session->'session'->>'member_name')::text AS member_name
    ),
    affiliate_context AS (
      SELECT
        a.codigo,
        coalesce(a.nome, a.codigo) AS nome,
        a.materiais_json,
        sr.member_id,
        sr.member_name
      FROM session_row sr
      JOIN public.afiliados a
        ON a.codigo = sr.codigo
       AND a.ativo = true
      JOIN public.afiliado_membros m
        ON m.id = sr.member_id
       AND m.afiliado_id = a.id
       AND m.ativo = true
    ),
    dias AS (
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
      JOIN affiliate_context ac
        ON upper(ml.afiliado_codigo) = ac.codigo
      WHERE ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY 1
    ),
    trend AS (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'dia', to_char(d.dia, 'DD/MM'),
            'total', coalesce(c.total, 0)
          )
          ORDER BY d.dia ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM dias d
      LEFT JOIN counts c ON d.dia = c.dia
    ),
    onboarding AS (
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
                  ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC
                )
                FROM public.onboarding_steps s
                WHERE s.onboarding_id = recent.id
              ), '[]'::jsonb),
              'calls', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', log.id,
                    'realizado_em', log.created_at,
                    'member_name', coalesce(log.details->>'member_name', ''),
                    'step_title', coalesce(log.details->>'step_title', ''),
                    'notes', coalesce(log.details->>'notes', '')
                  )
                  ORDER BY log.created_at DESC
                )
                FROM public.audit_logs log
                WHERE log.acao = 'PARTNER_CALL_FOLLOWUP'
                  AND log.entity = 'onboarding_requests'
                  AND log.entity_id = recent.id::text
              ), '[]'::jsonb),
              'uploads', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', u.id,
                    'step_code', u.step_code,
                    'file_path', u.file_path,
                    'status', u.status,
                    'rejection_reason', u.rejection_reason,
                    'created_by', u.created_by,
                    'created_at', u.created_at
                  )
                  ORDER BY u.created_at DESC
                )
                FROM public.onboarding_uploads u
                WHERE u.onboarding_id = recent.id
              ), '[]'::jsonb),
              'escola_tel', recent.escola_tel,
              'escola_email', recent.escola_email,
              'director_nome', recent.director_nome,
              'director_tel', recent.director_tel,
              'escola_morada', recent.escola_morada,
              'escola_municipio', recent.escola_municipio,
              'escola_provincia', recent.escola_provincia,
              'escola_nif', recent.escola_nif
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
              escola_morada,
              escola_municipio,
              escola_provincia,
              escola_nif
            FROM public.onboarding_requests
            WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
            ORDER BY created_at DESC
            LIMIT 50
          ) recent
        ), '[]'::jsonb)
      ) AS data
      FROM public.onboarding_requests obr
      WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
    ),
    leads AS (
      SELECT coalesce((
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
          WHERE upper(afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
          ORDER BY created_at DESC
          LIMIT 50
        ) recent
      ), '[]'::jsonb) AS data
    ),
    stats AS (
      SELECT jsonb_build_object(
        'total_diagnosticos', count(*),
        'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
        'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
        'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
        'trend', (SELECT data FROM trend),
        'onboarding', coalesce((SELECT data FROM onboarding), jsonb_build_object(
          'total', 0,
          'pendentes', 0,
          'em_configuracao', 0,
          'fechadas', 0,
          'escolas', '[]'::jsonb
        )),
        'leads', (SELECT data FROM leads)
      ) AS data
      FROM public.marketing_leads ml
      WHERE upper(ml.afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
    )
    SELECT coalesce(
      (
        SELECT jsonb_build_object(
          'ok', true,
          'codigo', ac.codigo,
          'nome', ac.nome,
          'member', jsonb_build_object(
            'id', ac.member_id,
            'name', ac.member_name
          ),
          'materiais', coalesce(ac.materiais_json, '[]'::jsonb),
          'stats', coalesce((SELECT data FROM stats), jsonb_build_object(
            'total_diagnosticos', 0,
            'novos', 0,
            'em_contacto', 0,
            'convertidos', 0,
            'trend', '[]'::jsonb,
            'onboarding', jsonb_build_object(
              'total', 0,
              'pendentes', 0,
              'em_configuracao', 0,
              'fechadas', 0,
              'escolas', '[]'::jsonb
            ),
            'leads', '[]'::jsonb
          ))
        )
        FROM affiliate_context ac
        LIMIT 1
      ),
      jsonb_build_object('ok', false, 'error', 'session_not_found')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_onboarding_call_followup_by_session(
  p_session_id uuid,
  p_codigo text,
  p_onboarding_token text,
  p_step_code text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo text;
  v_member_id uuid;
  v_member_name text;
  v_onboarding_id uuid;
  v_escola_id uuid;
  v_step_title text;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);

  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_codigo := (v_session->'session'->>'codigo')::text;
  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := (v_session->'session'->>'member_name')::text;

  SELECT r.id, r.escola_id
    INTO v_onboarding_id, v_escola_id
  FROM public.onboarding_requests r
  WHERE r.tracking_token = p_onboarding_token
    AND upper(coalesce(r.financeiro->>'influencer_codigo', '')) = v_codigo
  LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
  END IF;

  IF p_step_code IS NOT NULL AND btrim(p_step_code) <> '' THEN
    SELECT s.title
      INTO v_step_title
    FROM public.onboarding_steps s
    WHERE s.onboarding_id = v_onboarding_id
      AND s.step_code = p_step_code
    LIMIT 1;
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    acao,
    tabela,
    registro_id,
    entity,
    entity_id,
    details
  ) VALUES (
    v_escola_id,
    'influencer_portal',
    'PARTNER_CALL_FOLLOWUP',
    'onboarding_requests',
    v_onboarding_id::text,
    'onboarding_requests',
    v_onboarding_id::text,
    jsonb_build_object(
      'member_id', v_member_id,
      'member_name', v_member_name,
      'influencer_codigo', v_codigo,
      'step_code', p_step_code,
      'step_title', coalesce(v_step_title, ''),
      'notes', coalesce(p_notes, ''),
      'realizado_em', now()
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal_by_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_onboarding_call_followup_by_session(uuid, text, text, text, text) TO anon, authenticated;

COMMIT;
