BEGIN;

ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS crm_risk_score integer NOT NULL DEFAULT 0 CHECK (crm_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS crm_risk_level text NOT NULL DEFAULT 'baixo'
    CHECK (crm_risk_level IN ('baixo', 'medio', 'alto')),
  ADD COLUMN IF NOT EXISTS crm_risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS crm_risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_risk_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ix_onboarding_requests_partner_risk
  ON public.onboarding_requests ((upper(coalesce(financeiro->>'influencer_codigo', ''))), crm_risk_level, crm_risk_score DESC);

UPDATE public.crm_leads l
SET onboarding_request_id = r.id
FROM public.onboarding_requests r
WHERE l.onboarding_request_id IS NULL
  AND r.crm_lead_id = l.id;

UPDATE public.onboarding_requests r
SET crm_lead_id = l.id
FROM public.crm_leads l
WHERE r.crm_lead_id IS NULL
  AND l.onboarding_request_id = r.id;

CREATE OR REPLACE FUNCTION public.sync_influencer_school_360_risk(
  p_session_id uuid,
  p_codigo text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo_upper text := upper(trim(coalesce(p_codigo, '')));
  v_member_id uuid;
  v_count integer := 0;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_items');
  END IF;

  WITH incoming AS (
    SELECT
      nullif(item->>'onboarding_request_id', '')::uuid AS onboarding_request_id,
      greatest(0, least(100, coalesce((item->>'risk_score')::integer, 0))) AS risk_score,
      CASE
        WHEN item->>'risk_level' IN ('baixo', 'medio', 'alto') THEN item->>'risk_level'
        ELSE 'baixo'
      END AS risk_level,
      CASE
        WHEN jsonb_typeof(item->'risk_reasons') = 'array' THEN item->'risk_reasons'
        ELSE '[]'::jsonb
      END AS risk_reasons,
      coalesce(item->'snapshot', '{}'::jsonb) AS snapshot
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
    WHERE nullif(item->>'onboarding_request_id', '') IS NOT NULL
  ),
  updated AS (
    UPDATE public.onboarding_requests r
    SET
      crm_risk_score = i.risk_score,
      crm_risk_level = i.risk_level,
      crm_risk_reasons = i.risk_reasons,
      crm_risk_snapshot = i.snapshot || jsonb_build_object(
        'synced_by_membro_id', v_member_id,
        'synced_at', now()
      ),
      crm_risk_updated_at = now()
    FROM incoming i
    WHERE r.id = i.onboarding_request_id
      AND upper(coalesce(r.financeiro->>'influencer_codigo', '')) = v_codigo_upper
    RETURNING r.id
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_influencer_school_360_risk(uuid, text, jsonb) TO anon, authenticated;

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
              'id', recent.id,
              'onboarding_request_id', recent.id,
              'crm_lead_id', recent.crm_lead_id,
              'escola_id', recent.escola_id,
              'data', recent.created_at,
              'status', recent.status,
              'escola', recent.escola_nome,
              'plano', recent.financeiro->>'plano_interesse',
              'plano_label', recent.financeiro->>'plano_interesse_label',
              'total_alunos', recent.financeiro->>'total_alunos',
              'token', recent.tracking_token,
              'faixa_propina', recent.faixa_propina,
              'risk_score', recent.crm_risk_score,
              'risk_level', recent.crm_risk_level,
              'risk_reasons', recent.crm_risk_reasons,
              'risk_updated_at', recent.crm_risk_updated_at,
              'risk_snapshot', recent.crm_risk_snapshot,
              'implantation_status', recent.implantation_status,
              'implantation_checklist', coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()),
              'implantation_progress', jsonb_build_object(
                'completed', (
                  SELECT count(*)
                  FROM jsonb_array_elements(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist())) item
                  WHERE coalesce((item->>'completed')::boolean, false)
                ),
                'total', jsonb_array_length(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()))
              ),
              'acceptance_term_file_path', recent.acceptance_term_file_path,
              'acceptance_signed_by', recent.acceptance_signed_by,
              'acceptance_signed_role', recent.acceptance_signed_role,
              'acceptance_signed_at', recent.acceptance_signed_at,
              'acceptance_validated_at', recent.acceptance_validated_at,
              'acceptance_validated_by', recent.acceptance_validated_by,
              'acceptance_notes', recent.acceptance_notes,
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
                    'created_at', u.created_at,
                    'document_type', u.document_type,
                    'partner_review_note', u.partner_review_note,
                    'partner_reviewed_at', u.partner_reviewed_at,
                    'partner_reviewed_by', u.partner_reviewed_by,
                    'partner_reviewed_by_name', reviewer.nome
                  )
                  ORDER BY u.created_at DESC
                )
                FROM public.onboarding_uploads u
                LEFT JOIN public.afiliado_membros reviewer
                  ON reviewer.id = u.partner_reviewed_by
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
              crm_lead_id,
              escola_id,
              created_at,
              status,
              escola_nome,
              financeiro,
              tracking_token,
              faixa_propina,
              crm_risk_score,
              crm_risk_level,
              crm_risk_reasons,
              crm_risk_updated_at,
              crm_risk_snapshot,
              implantation_status,
              implantation_checklist,
              acceptance_term_file_path,
              acceptance_signed_by,
              acceptance_signed_role,
              acceptance_signed_at,
              acceptance_validated_at,
              acceptance_validated_by,
              acceptance_notes,
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

GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal_by_session(uuid, text) TO anon, authenticated;

COMMIT;
