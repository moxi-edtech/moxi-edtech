BEGIN;

-- 1. Add role column to public.afiliado_membros with operator as default
ALTER TABLE public.afiliado_membros 
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'operator' 
  CONSTRAINT afiliado_membros_role_check CHECK (role IN ('owner', 'operator'));

-- 2. Backfill: Set the earliest member of each affiliate (which represents the original owner/seeded user) to 'owner'
WITH owner_members AS (
  SELECT DISTINCT ON (afiliado_id) id
  FROM public.afiliado_membros
  ORDER BY afiliado_id, created_at ASC
)
UPDATE public.afiliado_membros
SET role = 'owner'
WHERE id IN (SELECT id FROM owner_members);

-- 3. Update public.create_afiliado_admin to insert seeded member with role 'owner'
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
    ativo,
    role
  )
  VALUES (
    v_new_id,
    v_nome,
    v_pin_hash,
    true,
    'owner'
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

-- 4. Update public.get_influencer_member_portal_by_session to retrieve and return member's role
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
        sr.member_name,
        m.role AS member_role
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
            'name', ac.member_name,
            'role', ac.member_role
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

COMMIT;
