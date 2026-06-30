BEGIN;

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_leads_crm_lead_id
  ON public.marketing_leads (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_marketing_leads_afiliado_created_at
  ON public.marketing_leads (afiliado_codigo, created_at DESC);

COMMENT ON COLUMN public.marketing_leads.crm_lead_id IS
  'Lead do CRM explicitamente originado a partir deste lead de marketing.';

COMMENT ON COLUMN public.marketing_leads.converted_at IS
  'Timestamp em que o lead de marketing foi convertido para lead CRM.';

COMMENT ON COLUMN public.marketing_leads.converted_by_membro_id IS
  'Membro do parceiro que realizou a conversao do lead de marketing para CRM.';

WITH candidate_matches AS (
  SELECT
    ml.id AS marketing_lead_id,
    l.id AS crm_lead_id,
    row_number() OVER (
      PARTITION BY ml.id
      ORDER BY abs(extract(epoch FROM (coalesce(l.created_at, now()) - coalesce(ml.created_at, now())))) ASC, l.created_at ASC
    ) AS marketing_rank,
    count(*) OVER (PARTITION BY ml.id) AS marketing_candidate_count,
    row_number() OVER (
      PARTITION BY l.id
      ORDER BY abs(extract(epoch FROM (coalesce(l.created_at, now()) - coalesce(ml.created_at, now())))) ASC, ml.created_at ASC
    ) AS crm_rank,
    count(*) OVER (PARTITION BY l.id) AS crm_candidate_count
  FROM public.marketing_leads ml
  JOIN public.crm_leads l
    ON upper(coalesce(ml.afiliado_codigo, '')) = upper(coalesce(l.afiliado_codigo, ''))
   AND lower(trim(coalesce(ml.escola, ''))) = lower(trim(coalesce(l.nome_escola, '')))
  WHERE ml.crm_lead_id IS NULL
),
safe_matches AS (
  SELECT marketing_lead_id, crm_lead_id
  FROM candidate_matches
  WHERE marketing_rank = 1
    AND crm_rank = 1
    AND marketing_candidate_count = 1
    AND crm_candidate_count = 1
)
UPDATE public.marketing_leads ml
SET
  crm_lead_id = sm.crm_lead_id,
  converted_at = coalesce(ml.converted_at, now()),
  metadata_json = coalesce(ml.metadata_json, '{}'::jsonb) || jsonb_build_object(
    'crm_link_source', 'backfill_unambiguous_match',
    'crm_linked_at', now()
  )
FROM safe_matches sm
WHERE ml.id = sm.marketing_lead_id;

DROP FUNCTION IF EXISTS public.create_influencer_crm_lead(
  uuid, text, text, text, text, text, text, integer, text, text, timestamptz, integer, integer, uuid
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
  p_responsavel_membro_id uuid DEFAULT NULL,
  p_marketing_lead_id uuid DEFAULT NULL
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
  v_marketing_lead public.marketing_leads%ROWTYPE;
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

  IF p_marketing_lead_id IS NOT NULL THEN
    SELECT *
      INTO v_marketing_lead
    FROM public.marketing_leads
    WHERE id = p_marketing_lead_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'marketing_lead_not_found');
    END IF;

    IF upper(coalesce(v_marketing_lead.afiliado_codigo, '')) <> v_codigo_upper THEN
      RETURN jsonb_build_object('ok', false, 'error', 'marketing_lead_not_owned_by_affiliate');
    END IF;

    IF v_marketing_lead.crm_lead_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'marketing_lead_already_linked',
        'crm_lead_id', v_marketing_lead.crm_lead_id
      );
    END IF;
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

  IF p_marketing_lead_id IS NOT NULL THEN
    UPDATE public.marketing_leads
    SET
      crm_lead_id = v_lead_id,
      converted_at = now(),
      converted_by_membro_id = v_member_id,
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'crm_link_source', 'create_influencer_crm_lead',
        'crm_linked_at', now(),
        'crm_lead_id', v_lead_id
      )
    WHERE id = p_marketing_lead_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'marketing_lead_id', p_marketing_lead_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_influencer_crm_lead(
  uuid, text, text, text, text, text, text, integer, text, text, timestamptz, integer, integer, uuid, uuid
) TO anon, authenticated;

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
            'tracking_token', onboarding.tracking_token,
            'marketing_lead_id', marketing.id
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
        LEFT JOIN public.marketing_leads marketing
          ON marketing.crm_lead_id = l.id
        WHERE l.afiliado_codigo = v_codigo_upper
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_crm_leads(uuid, text) TO anon, authenticated;

COMMIT;
