BEGIN;

CREATE OR REPLACE FUNCTION public.update_influencer_crm_lead_commercial_terms(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_plano_estimado text,
  p_alunos_estimados integer,
  p_trial_days integer,
  p_taxa_ativacao integer
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

  IF coalesce(p_alunos_estimados, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_alunos_estimados');
  END IF;

  IF p_trial_days IS NULL OR p_trial_days < 0 OR p_trial_days > 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_trial_days');
  END IF;

  IF p_taxa_ativacao IS NULL OR p_taxa_ativacao < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_taxa_ativacao');
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
    taxa_ativacao = p_taxa_ativacao
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
        'taxa_ativacao', v_previous.taxa_ativacao
      ),
      'after', jsonb_build_object(
        'plano_estimado', v_plan,
        'alunos_estimados', coalesce(p_alunos_estimados, 0),
        'trial_days', p_trial_days,
        'taxa_ativacao', p_taxa_ativacao
      )
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_commercial_terms(uuid, text, uuid, text, integer, integer, integer) TO anon, authenticated;

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
      'taxa_ativacao', v_lead.taxa_ativacao
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
