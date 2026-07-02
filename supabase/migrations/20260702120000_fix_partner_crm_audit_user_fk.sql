BEGIN;

CREATE OR REPLACE FUNCTION public.log_crm_lead_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.etapa <> NEW.etapa THEN
    INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
    VALUES (
      NULL,
      NULL,
      'CRM_LEAD_STAGE_MOVE',
      'crm_leads',
      NEW.id::text,
      jsonb_build_object(
        'lead_nome', NEW.nome_escola,
        'afiliado_codigo', NEW.afiliado_codigo,
        'origem_etapa', OLD.etapa,
        'nova_etapa', NEW.etapa,
        'motivo_perda', NEW.motivo_perda,
        'member_id', NEW.membro_id
      )
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
    VALUES (
      NULL,
      NULL,
      'CRM_LEAD_CREATED',
      'crm_leads',
      NEW.id::text,
      jsonb_build_object(
        'lead_nome', NEW.nome_escola,
        'afiliado_codigo', NEW.afiliado_codigo,
        'etapa', NEW.etapa,
        'member_id', NEW.membro_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_influencer_crm_lead_action(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_proxima_acao text,
  p_proxima_acao_data timestamptz,
  p_interaction_note text DEFAULT NULL,
  p_responsavel_membro_id uuid DEFAULT NULL
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
  v_responsavel_nome text;
  v_lead public.crm_leads%ROWTYPE;
  v_next_action text := nullif(trim(coalesce(p_proxima_acao, '')), '');
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := (v_session->'session'->>'member_name')::text;

  IF p_responsavel_membro_id IS NOT NULL THEN
    SELECT m.nome
      INTO v_responsavel_nome
    FROM public.afiliados a
    JOIN public.afiliado_membros m
      ON m.afiliado_id = a.id
    WHERE a.codigo = v_codigo_upper
      AND a.ativo = true
      AND m.id = p_responsavel_membro_id
      AND m.ativo = true
    LIMIT 1;

    IF v_responsavel_nome IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'responsavel_not_found_or_access_denied');
    END IF;
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

  UPDATE public.crm_leads
  SET
    proxima_acao = v_next_action,
    proxima_acao_data = p_proxima_acao_data,
    responsavel_membro_id = coalesce(p_responsavel_membro_id, responsavel_membro_id)
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  IF v_next_action IS NULL THEN
    UPDATE public.partner_tasks
    SET
      status = 'cancelled',
      metadata = metadata || jsonb_build_object('cancelled_by_action_update', true)
    WHERE crm_lead_id = p_lead_id
      AND task_type = 'follow_up'
      AND status = 'open';
  ELSE
    UPDATE public.partner_tasks
    SET
      title = v_next_action,
      due_at = p_proxima_acao_data,
      responsavel_membro_id = coalesce(p_responsavel_membro_id, responsavel_membro_id),
      onboarding_request_id = v_lead.onboarding_request_id,
      metadata = metadata || jsonb_build_object(
        'source', 'crm_lead_action',
        'last_updated_by_member_id', v_member_id,
        'last_updated_by_member_name', v_member_name
      )
    WHERE crm_lead_id = p_lead_id
      AND task_type = 'follow_up'
      AND status = 'open';

    IF NOT FOUND THEN
      INSERT INTO public.partner_tasks (
        afiliado_codigo,
        membro_id,
        responsavel_membro_id,
        crm_lead_id,
        onboarding_request_id,
        title,
        task_type,
        status,
        due_at,
        metadata
      )
      VALUES (
        v_codigo_upper,
        v_member_id,
        coalesce(p_responsavel_membro_id, v_lead.responsavel_membro_id, v_lead.membro_id),
        p_lead_id,
        v_lead.onboarding_request_id,
        v_next_action,
        'follow_up',
        'open',
        p_proxima_acao_data,
        jsonb_build_object(
          'source', 'crm_lead_action',
          'created_by_member_id', v_member_id,
          'created_by_member_name', v_member_name
        )
      );
    END IF;
  END IF;

  IF p_interaction_note IS NOT NULL AND trim(p_interaction_note) <> '' THEN
    INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
    VALUES (
      NULL,
      NULL,
      'CRM_LEAD_NOTE_ADDED',
      'crm_leads',
      p_lead_id::text,
      jsonb_build_object(
        'member_id', v_member_id,
        'member_name', v_member_name,
        'responsavel_membro_id', p_responsavel_membro_id,
        'responsavel_membro_nome', v_responsavel_nome,
        'notes', p_interaction_note
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

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
  v_accepted_at timestamptz;
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

  v_accepted_at := CASE
    WHEN v_status IN ('aceite_comercial', 'aguardando_contrato_klasse')
      THEN coalesce(v_previous.aceite_comercial_at, now())
    ELSE NULL
  END;

  UPDATE public.crm_leads
  SET
    plano_estimado = v_plan,
    alunos_estimados = coalesce(p_alunos_estimados, 0),
    trial_days = p_trial_days,
    taxa_ativacao = p_taxa_ativacao,
    mensalidade_kz = p_mensalidade_kz,
    commercial_status = v_status,
    commercial_status_updated_at = now(),
    aceite_comercial_at = v_accepted_at
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  INSERT INTO public.crm_commercial_proposals (
    crm_lead_id,
    afiliado_codigo,
    created_by_membro_id,
    status,
    plano_estimado,
    alunos_estimados,
    trial_days,
    taxa_ativacao,
    mensalidade_kz,
    proposal_file_path,
    proposal_file_name,
    accepted_at,
    metadata
  )
  VALUES (
    p_lead_id,
    v_codigo_upper,
    coalesce(v_previous.membro_id, v_member_id),
    v_status,
    v_plan,
    coalesce(p_alunos_estimados, 0),
    p_trial_days,
    p_taxa_ativacao,
    p_mensalidade_kz,
    v_previous.proposal_file_path,
    v_previous.proposal_file_name,
    v_accepted_at,
    jsonb_build_object(
      'source', 'crm_lead_commercial_terms',
      'last_updated_by_member_id', v_member_id,
      'last_updated_by_member_name', v_member_name
    )
  )
  ON CONFLICT (crm_lead_id) DO UPDATE
  SET
    afiliado_codigo = EXCLUDED.afiliado_codigo,
    created_by_membro_id = coalesce(public.crm_commercial_proposals.created_by_membro_id, EXCLUDED.created_by_membro_id),
    status = EXCLUDED.status,
    plano_estimado = EXCLUDED.plano_estimado,
    alunos_estimados = EXCLUDED.alunos_estimados,
    trial_days = EXCLUDED.trial_days,
    taxa_ativacao = EXCLUDED.taxa_ativacao,
    mensalidade_kz = EXCLUDED.mensalidade_kz,
    accepted_at = EXCLUDED.accepted_at,
    metadata = public.crm_commercial_proposals.metadata || EXCLUDED.metadata;

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
    NULL,
    'CRM_LEAD_COMMERCIAL_UPDATED',
    'crm_leads',
    p_lead_id::text,
    jsonb_build_object(
      'member_id', v_member_id,
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

  INSERT INTO public.crm_commercial_proposals (
    crm_lead_id,
    afiliado_codigo,
    created_by_membro_id,
    status,
    plano_estimado,
    alunos_estimados,
    trial_days,
    taxa_ativacao,
    mensalidade_kz,
    proposal_file_path,
    proposal_file_name,
    accepted_at,
    metadata
  )
  VALUES (
    p_lead_id,
    v_codigo_upper,
    coalesce(v_lead.membro_id, v_member_id),
    v_next_status,
    v_lead.plano_estimado,
    coalesce(v_lead.alunos_estimados, 0),
    coalesce(v_lead.trial_days, 15),
    coalesce(v_lead.taxa_ativacao, 0),
    v_lead.mensalidade_kz,
    p_file_path,
    p_file_name,
    v_lead.aceite_comercial_at,
    jsonb_build_object(
      'source', 'crm_lead_proposal_upload',
      'last_updated_by_member_id', v_member_id,
      'last_updated_by_member_name', v_member_name
    )
  )
  ON CONFLICT (crm_lead_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    proposal_file_path = EXCLUDED.proposal_file_path,
    proposal_file_name = EXCLUDED.proposal_file_name,
    metadata = public.crm_commercial_proposals.metadata || EXCLUDED.metadata;

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
    NULL,
    'CRM_LEAD_PROPOSAL_UPLOADED',
    'crm_leads',
    p_lead_id::text,
    jsonb_build_object(
      'member_id', v_member_id,
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
    NULL,
    'CRM_LEAD_CONVERTED_TO_ONBOARDING',
    'crm_leads',
    v_lead.id::text,
    jsonb_build_object(
      'lead_nome', v_lead.nome_escola,
      'afiliado_codigo', v_codigo_upper,
      'member_id', v_member_id,
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

COMMIT;
