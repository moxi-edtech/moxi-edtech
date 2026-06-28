BEGIN;

ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS onboarding_request_id uuid REFERENCES public.onboarding_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_onboarding_requests_crm_lead_id
  ON public.onboarding_requests (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_crm_leads_onboarding_request_id
  ON public.crm_leads (onboarding_request_id)
  WHERE onboarding_request_id IS NOT NULL;

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
      'converted_by_membro_nome', v_member_name
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
    etapa = 'ganho',
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
            'etapa', l.etapa,
            'motivo_perda', l.motivo_perda,
            'proxima_acao', l.proxima_acao,
            'proxima_acao_data', l.proxima_acao_data,
            'onboarding_request_id', l.onboarding_request_id,
            'converted_at', l.converted_at,
            'tracking_token', r.tracking_token,
            'created_at', l.created_at,
            'updated_at', l.updated_at
          )
          ORDER BY l.created_at DESC
        )
        FROM public.crm_leads l
        LEFT JOIN public.onboarding_requests r
          ON r.id = l.onboarding_request_id
        WHERE l.afiliado_codigo = v_codigo_upper
      ),
      '[]'::jsonb
    )
  );
END;
$$;

COMMIT;
