BEGIN;

ALTER TABLE public.onboarding_uploads
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS partner_review_note text,
  ADD COLUMN IF NOT EXISTS partner_reviewed_by uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_reviewed_at timestamptz;

ALTER TABLE public.onboarding_uploads
  DROP CONSTRAINT IF EXISTS onboarding_uploads_status_check;

ALTER TABLE public.onboarding_uploads
  ADD CONSTRAINT onboarding_uploads_status_check
  CHECK (status IN (
    'pendente',
    'processando',
    'em_revisao_parceiro',
    'pendencia_cliente',
    'pronto_para_klasse',
    'aprovado',
    'rejeitado'
  ));

ALTER TABLE public.onboarding_uploads
  DROP CONSTRAINT IF EXISTS onboarding_uploads_document_type_check;

ALTER TABLE public.onboarding_uploads
  ADD CONSTRAINT onboarding_uploads_document_type_check
  CHECK (
    document_type IS NULL
    OR document_type IN ('legal', 'planilha', 'contrato', 'logotipo', 'pauta', 'termo_aceite', 'outro')
  );

CREATE INDEX IF NOT EXISTS idx_onboarding_uploads_partner_triage
  ON public.onboarding_uploads(onboarding_id, status, document_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.partner_triage_onboarding_upload(
  p_session_id uuid,
  p_codigo text,
  p_tracking_token text,
  p_upload_id uuid,
  p_status text,
  p_document_type text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session record;
  v_request public.onboarding_requests%ROWTYPE;
  v_upload public.onboarding_uploads%ROWTYPE;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_document_type text := nullif(lower(btrim(coalesce(p_document_type, ''))), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  SELECT *
    INTO v_session
  FROM public.require_influencer_active_session(p_session_id, p_codigo)
  LIMIT 1;

  IF v_status NOT IN ('em_revisao_parceiro', 'pendencia_cliente', 'pronto_para_klasse') THEN
    RAISE EXCEPTION 'invalid_partner_status' USING ERRCODE = '22023';
  END IF;

  IF v_document_type IS NOT NULL
     AND v_document_type NOT IN ('legal', 'planilha', 'contrato', 'logotipo', 'pauta', 'termo_aceite', 'outro') THEN
    RAISE EXCEPTION 'invalid_document_type' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_request
  FROM public.onboarding_requests r
  WHERE r.tracking_token = p_tracking_token
    AND (
      r.afiliado_id = v_session.afiliado_id
      OR upper(coalesce(r.financeiro->>'influencer_codigo', '')) = v_session.codigo
    )
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'onboarding_not_found_or_access_denied' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_upload
  FROM public.onboarding_uploads u
  WHERE u.id = p_upload_id
    AND u.onboarding_id = v_request.id
  LIMIT 1;

  IF v_upload.id IS NULL THEN
    RAISE EXCEPTION 'upload_not_found_or_access_denied' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload.status IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'upload_final_review_locked' USING ERRCODE = '42501';
  END IF;

  UPDATE public.onboarding_uploads
  SET
    status = v_status,
    document_type = coalesce(v_document_type, document_type),
    partner_review_note = v_note,
    partner_reviewed_by = v_session.member_id,
    partner_reviewed_at = now(),
    rejection_reason = CASE
      WHEN v_status = 'pendencia_cliente' THEN v_note
      ELSE rejection_reason
    END,
    updated_at = now()
  WHERE id = p_upload_id;

  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    acao,
    tabela,
    registro_id,
    entity,
    entity_id,
    details
  )
  VALUES (
    v_request.escola_id,
    'influencer_portal',
    'ONBOARDING_UPLOAD_PARTNER_TRIAGED',
    'onboarding_uploads',
    p_upload_id::text,
    'onboarding_uploads',
    p_upload_id::text,
    jsonb_build_object(
      'onboarding_id', v_request.id,
      'tracking_token', v_request.tracking_token,
      'codigo', v_session.codigo,
      'member_id', v_session.member_id,
      'member_name', v_session.member_name,
      'previous_status', v_upload.status,
      'next_status', v_status,
      'document_type', coalesce(v_document_type, v_upload.document_type),
      'note', v_note
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'upload_id', p_upload_id,
    'status', v_status,
    'document_type', coalesce(v_document_type, v_upload.document_type),
    'partner_review_note', v_note,
    'partner_reviewed_by', v_session.member_id,
    'partner_reviewed_at', now()
  );
END;
$$;

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
              created_at,
              status,
              escola_nome,
              financeiro,
              tracking_token,
              faixa_propina,
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

GRANT EXECUTE ON FUNCTION public.partner_triage_onboarding_upload(uuid, text, text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal_by_session(uuid, text) TO anon, authenticated;

COMMIT;
