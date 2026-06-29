BEGIN;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS responsavel_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL;

UPDATE public.crm_leads
SET responsavel_membro_id = membro_id
WHERE responsavel_membro_id IS NULL
  AND membro_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel_membro
  ON public.crm_leads(responsavel_membro_id);

COMMENT ON COLUMN public.crm_leads.responsavel_membro_id IS
  'Membro do parceiro responsavel pelo proximo follow-up operacional do lead.';

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

DROP FUNCTION IF EXISTS public.create_influencer_crm_lead(
  uuid, text, text, text, text, text, text, integer, text, text, timestamptz, integer, integer
);

CREATE OR REPLACE FUNCTION public.create_influencer_crm_lead(
  p_session_id uuid,
  p_codigo text,
  p_nome_escola text,
  p_nome_contacto text,
  p_telefone text,
  p_email text,
  p_segmento text,
  p_alunos_estimados integer,
  p_plano_estimado text,
  p_proxima_acao text,
  p_proxima_acao_data timestamptz DEFAULT NULL,
  p_trial_days integer DEFAULT 15,
  p_taxa_ativacao integer DEFAULT 50000,
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
  v_responsavel_id uuid;
  v_lead_id uuid;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_responsavel_id := coalesce(p_responsavel_membro_id, v_member_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.afiliados a
    JOIN public.afiliado_membros m
      ON m.afiliado_id = a.id
    WHERE a.codigo = v_codigo_upper
      AND a.ativo = true
      AND m.id = v_responsavel_id
      AND m.ativo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'responsavel_not_found_or_access_denied');
  END IF;

  INSERT INTO public.crm_leads (
    afiliado_codigo,
    membro_id,
    responsavel_membro_id,
    nome_escola,
    nome_contacto,
    telefone,
    email,
    segmento,
    alunos_estimados,
    plano_estimado,
    proxima_acao,
    proxima_acao_data,
    trial_days,
    taxa_ativacao
  ) VALUES (
    v_codigo_upper,
    v_member_id,
    v_responsavel_id,
    p_nome_escola,
    p_nome_contacto,
    p_telefone,
    p_email,
    p_segmento,
    p_alunos_estimados,
    p_plano_estimado,
    p_proxima_acao,
    p_proxima_acao_data,
    coalesce(p_trial_days, 15),
    coalesce(p_taxa_ativacao, 50000)
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id);
END;
$$;

DROP FUNCTION IF EXISTS public.update_influencer_crm_lead_action(
  uuid, text, uuid, text, timestamptz, text
);

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

  UPDATE public.crm_leads
  SET
    proxima_acao = p_proxima_acao,
    proxima_acao_data = p_proxima_acao_data,
    responsavel_membro_id = coalesce(p_responsavel_membro_id, responsavel_membro_id)
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  IF p_interaction_note IS NOT NULL AND trim(p_interaction_note) <> '' THEN
    INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
    VALUES (
      NULL,
      coalesce(v_member_id::text, 'system'),
      'CRM_LEAD_NOTE_ADDED',
      'crm_leads',
      p_lead_id::text,
      jsonb_build_object(
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

GRANT EXECUTE ON FUNCTION public.get_influencer_crm_leads(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_crm_lead(uuid, text, text, text, text, text, text, integer, text, text, timestamptz, integer, integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_action(uuid, text, uuid, text, timestamptz, text, uuid) TO anon, authenticated;

COMMIT;
