BEGIN;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS mensalidade_kz integer CHECK (mensalidade_kz IS NULL OR mensalidade_kz >= 0),
  ADD COLUMN IF NOT EXISTS commercial_status varchar(50) NOT NULL DEFAULT 'rascunho'
    CHECK (commercial_status IN ('rascunho', 'proposta_enviada', 'aceite_comercial', 'aguardando_contrato_klasse')),
  ADD COLUMN IF NOT EXISTS commercial_status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS aceite_comercial_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_file_path text,
  ADD COLUMN IF NOT EXISTS proposal_file_name text;

UPDATE public.crm_leads
SET
  commercial_status = 'aceite_comercial',
  commercial_status_updated_at = coalesce(converted_at, updated_at, created_at, now()),
  aceite_comercial_at = coalesce(aceite_comercial_at, converted_at, updated_at, created_at, now())
WHERE onboarding_request_id IS NOT NULL
  AND commercial_status = 'rascunho';

DROP FUNCTION IF EXISTS public.update_influencer_crm_lead_commercial_terms(
  uuid, text, uuid, text, integer, integer, integer
);

CREATE OR REPLACE FUNCTION public.update_influencer_crm_lead_commercial_terms(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_plano_estimado text,
  p_alunos_estimados integer,
  p_trial_days integer,
  p_taxa_ativacao integer,
  p_mensalidade_kz integer,
  p_commercial_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo_upper text := upper(trim(p_codigo));
  v_member_id uuid;
  v_member_name text;
  v_previous public.crm_leads%ROWTYPE;
  v_plan text := lower(trim(coalesce(p_plano_estimado, '')));
  v_status text := lower(trim(coalesce(p_commercial_status, 'rascunho')));
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');

  IF v_plan NOT IN ('essencial', 'profissional', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_plan');
  END IF;

  IF v_status NOT IN ('rascunho', 'proposta_enviada', 'aceite_comercial', 'aguardando_contrato_klasse') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_commercial_status');
  END IF;

  IF coalesce(p_alunos_estimados, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_alunos_estimados');
  END IF;

  IF p_trial_days IS NULL OR p_trial_days < 0 OR p_trial_days > 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_trial_days');
  END IF;

  IF p_taxa_ativacao IS NULL OR p_taxa_ativacao < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_taxa_ativacao');
  END IF;

  IF p_mensalidade_kz IS NOT NULL AND p_mensalidade_kz < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_mensalidade_kz');
  END IF;

  IF v_status <> 'rascunho' AND coalesce(p_mensalidade_kz, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_mensalidade_kz');
  END IF;

  SELECT *
    INTO v_previous
  FROM public.crm_leads
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  UPDATE public.crm_leads
  SET
    plano_estimado = v_plan,
    alunos_estimados = coalesce(p_alunos_estimados, 0),
    trial_days = p_trial_days,
    taxa_ativacao = p_taxa_ativacao,
    mensalidade_kz = p_mensalidade_kz,
    commercial_status = v_status,
    commercial_status_updated_at = now(),
    aceite_comercial_at = CASE
      WHEN v_status IN ('aceite_comercial', 'aguardando_contrato_klasse')
        THEN coalesce(v_previous.aceite_comercial_at, now())
      ELSE NULL
    END
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    acao,
    entity,
    entity_id,
    details
  )
  VALUES (
    NULL,
    coalesce(v_member_id::text, 'system'),
    'CRM_LEAD_COMMERCIAL_UPDATED',
    'crm_leads',
    p_lead_id::text,
    jsonb_build_object(
      'member_name', v_member_name,
      'before', jsonb_build_object(
        'plano_estimado', v_previous.plano_estimado,
        'alunos_estimados', v_previous.alunos_estimados,
        'trial_days', v_previous.trial_days,
        'taxa_ativacao', v_previous.taxa_ativacao,
        'mensalidade_kz', v_previous.mensalidade_kz,
        'commercial_status', v_previous.commercial_status
      ),
      'after', jsonb_build_object(
        'plano_estimado', v_plan,
        'alunos_estimados', coalesce(p_alunos_estimados, 0),
        'trial_days', p_trial_days,
        'taxa_ativacao', p_taxa_ativacao,
        'mensalidade_kz', p_mensalidade_kz,
        'commercial_status', v_status
      )
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_commercial_terms(uuid, text, uuid, text, integer, integer, integer, integer, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.attach_influencer_crm_lead_proposal(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_file_path text,
  p_file_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo_upper text := upper(trim(p_codigo));
  v_member_id uuid;
  v_member_name text;
  v_lead public.crm_leads%ROWTYPE;
  v_next_status text;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');

  SELECT *
    INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  v_next_status := CASE
    WHEN v_lead.commercial_status = 'rascunho' THEN 'proposta_enviada'
    ELSE v_lead.commercial_status
  END;

  UPDATE public.crm_leads
  SET
    proposal_file_path = p_file_path,
    proposal_file_name = p_file_name,
    commercial_status = v_next_status,
    commercial_status_updated_at = CASE
      WHEN v_next_status <> v_lead.commercial_status THEN now()
      ELSE commercial_status_updated_at
    END
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    acao,
    entity,
    entity_id,
    details
  )
  VALUES (
    NULL,
    coalesce(v_member_id::text, 'system'),
    'CRM_LEAD_PROPOSAL_UPLOADED',
    'crm_leads',
    p_lead_id::text,
    jsonb_build_object(
      'member_name', v_member_name,
      'file_name', p_file_name,
      'commercial_status', v_next_status
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'commercial_status', v_next_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_influencer_crm_lead_proposal(uuid, text, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_influencer_crm_leads(
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
  v_codigo_upper text := upper(trim(p_codigo));
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'leads', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'nome_escola', l.nome_escola,
            'nome_contacto', l.nome_contacto,
            'telefone', l.telefone,
            'email', l.email,
            'segmento', l.segmento,
            'alunos_estimados', l.alunos_estimados,
            'plano_estimado', l.plano_estimado,
            'trial_days', l.trial_days,
            'taxa_ativacao', l.taxa_ativacao,
            'mensalidade_kz', l.mensalidade_kz,
            'commercial_status', l.commercial_status,
            'commercial_status_updated_at', l.commercial_status_updated_at,
            'aceite_comercial_at', l.aceite_comercial_at,
            'proposal_file_name', l.proposal_file_name,
            'proposal_file_path', l.proposal_file_path,
            'etapa', l.etapa,
            'motivo_perda', l.motivo_perda,
            'membro_id', l.membro_id,
            'membro_nome', criador.nome,
            'responsavel_membro_id', l.responsavel_membro_id,
            'responsavel_membro_nome', responsavel.nome,
            'responsavel_membro_role', responsavel.role,
            'proxima_acao', l.proxima_acao,
            'proxima_acao_data', l.proxima_acao_data,
            'created_at', l.created_at,
            'updated_at', l.updated_at,
            'onboarding_request_id', l.onboarding_request_id,
            'tracking_token', onboarding.tracking_token
          )
          ORDER BY l.created_at DESC
        )
        FROM public.crm_leads l
        LEFT JOIN public.afiliado_membros criador
          ON criador.id = l.membro_id
        LEFT JOIN public.afiliado_membros responsavel
          ON responsavel.id = l.responsavel_membro_id
        LEFT JOIN public.onboarding_requests onboarding
          ON onboarding.id = l.onboarding_request_id
        WHERE l.afiliado_codigo = v_codigo_upper
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_influencer_crm_lead_to_onboarding(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid
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
  v_member_name text;
  v_afiliado_id uuid;
  v_lead public.crm_leads%ROWTYPE;
  v_request_id uuid;
  v_tracking_token text;
  v_plan_label text;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');

  SELECT a.id
    INTO v_afiliado_id
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
   AND m.id = v_member_id
   AND m.ativo = true
  WHERE a.codigo = v_codigo_upper
    AND a.ativo = true
  LIMIT 1;

  IF v_afiliado_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'affiliate_not_found');
  END IF;

  SELECT *
    INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  IF v_lead.etapa = 'perdido' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lost_lead_cannot_convert');
  END IF;

  IF v_lead.etapa <> 'ganho' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_stage_not_ready');
  END IF;

  IF coalesce(trim(v_lead.plano_estimado), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_plan');
  END IF;

  IF coalesce(v_lead.commercial_status, 'rascunho') NOT IN ('aceite_comercial', 'aguardando_contrato_klasse') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'commercial_status_not_ready');
  END IF;

  IF v_lead.trial_days IS NULL OR v_lead.trial_days < 0 OR v_lead.trial_days > 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_trial_days');
  END IF;

  IF v_lead.taxa_ativacao IS NULL OR v_lead.taxa_ativacao <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_taxa_ativacao');
  END IF;

  IF v_lead.onboarding_request_id IS NOT NULL THEN
    SELECT r.tracking_token
      INTO v_tracking_token
    FROM public.onboarding_requests r
    WHERE r.id = v_lead.onboarding_request_id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_converted', true,
      'onboarding_request_id', v_lead.onboarding_request_id,
      'tracking_token', v_tracking_token
    );
  END IF;

  v_plan_label := CASE v_lead.plano_estimado
    WHEN 'profissional' THEN 'Profissional'
    WHEN 'premium' THEN 'Premium'
    ELSE 'Essencial'
  END;

  INSERT INTO public.onboarding_requests (
    status,
    escola_nome,
    escola_tel,
    escola_email,
    director_nome,
    director_tel,
    financeiro,
    utilizadores,
    notas_admin,
    crm_lead_id
  )
  VALUES (
    'pendente',
    v_lead.nome_escola,
    v_lead.telefone,
    v_lead.email,
    v_lead.nome_contacto,
    v_lead.telefone,
    jsonb_build_object(
      'total_alunos', nullif(v_lead.alunos_estimados, 0)::text,
      'plano_interesse', v_lead.plano_estimado,
      'plano_interesse_label', v_plan_label,
      'origem_campanha', 'crm_parceiro',
      'influencer_codigo', v_codigo_upper,
      'crm_lead_id', v_lead.id,
      'converted_by_membro_id', v_member_id,
      'converted_by_membro_nome', v_member_name,
      'trial_days', v_lead.trial_days,
      'taxa_ativacao', v_lead.taxa_ativacao,
      'mensalidade_kz', v_lead.mensalidade_kz,
      'commercial_status', v_lead.commercial_status,
      'proposal_file_name', v_lead.proposal_file_name
    ),
    jsonb_build_object(
      'principal', jsonb_build_object(
        'nome', coalesce(v_lead.nome_contacto, v_lead.nome_escola),
        'tel', coalesce(v_lead.telefone, ''),
        'nivel_exp', ''
      )
    ),
    'Pedido criado automaticamente a partir de lead CRM do parceiro ' || v_codigo_upper || '.',
    v_lead.id
  )
  RETURNING id, tracking_token INTO v_request_id, v_tracking_token;

  UPDATE public.crm_leads
  SET
    onboarding_request_id = v_request_id,
    converted_at = now(),
    converted_by_membro_id = v_member_id
  WHERE id = v_lead.id;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    acao,
    entity,
    entity_id,
    details
  )
  VALUES (
    NULL,
    coalesce(v_member_id::text, 'system'),
    'CRM_LEAD_CONVERTED_TO_ONBOARDING',
    'crm_leads',
    v_lead.id::text,
    jsonb_build_object(
      'lead_nome', v_lead.nome_escola,
      'afiliado_codigo', v_codigo_upper,
      'member_name', v_member_name,
      'onboarding_request_id', v_request_id,
      'tracking_token', v_tracking_token
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_converted', false,
    'onboarding_request_id', v_request_id,
    'tracking_token', v_tracking_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_influencer_crm_lead_to_onboarding(uuid, text, uuid) TO anon, authenticated;

COMMIT;
