BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_codigo varchar(50) NOT NULL REFERENCES public.afiliados(codigo) ON DELETE CASCADE,
  membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  responsavel_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  onboarding_request_id uuid REFERENCES public.onboarding_requests(id) ON DELETE SET NULL,
  escola_id uuid REFERENCES public.escolas(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  task_type varchar(40) NOT NULL DEFAULT 'follow_up'
    CHECK (task_type IN ('follow_up', 'demo', 'call', 'proposal', 'onboarding', 'support', 'financeiro', 'outro')),
  status varchar(30) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_partner_tasks_afiliado_status_due
  ON public.partner_tasks (afiliado_codigo, status, due_at);

CREATE INDEX IF NOT EXISTS idx_partner_tasks_responsavel_status_due
  ON public.partner_tasks (responsavel_membro_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_partner_tasks_crm_lead
  ON public.partner_tasks (crm_lead_id);

CREATE INDEX IF NOT EXISTS idx_partner_tasks_onboarding_request
  ON public.partner_tasks (onboarding_request_id);

CREATE TABLE IF NOT EXISTS public.crm_commercial_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  afiliado_codigo varchar(50) NOT NULL REFERENCES public.afiliados(codigo) ON DELETE CASCADE,
  created_by_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  status varchar(50) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'proposta_enviada', 'aceite_comercial', 'aguardando_contrato_klasse', 'rejeitada', 'cancelada')),
  plano_estimado varchar(50) NOT NULL DEFAULT 'essencial'
    CHECK (plano_estimado IN ('essencial', 'profissional', 'premium')),
  alunos_estimados integer NOT NULL DEFAULT 0 CHECK (alunos_estimados >= 0),
  trial_days integer NOT NULL DEFAULT 15 CHECK (trial_days >= 0 AND trial_days <= 30),
  taxa_ativacao integer NOT NULL DEFAULT 0 CHECK (taxa_ativacao >= 0),
  mensalidade_kz integer CHECK (mensalidade_kz IS NULL OR mensalidade_kz >= 0),
  proposal_file_path text,
  proposal_file_name text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_commercial_proposals_crm_lead
  ON public.crm_commercial_proposals (crm_lead_id);

CREATE INDEX IF NOT EXISTS idx_crm_commercial_proposals_afiliado_status
  ON public.crm_commercial_proposals (afiliado_codigo, status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.handle_partner_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at = coalesce(NEW.completed_at, now());
  END IF;
  IF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_tasks_updated_at ON public.partner_tasks;
CREATE TRIGGER trg_partner_tasks_updated_at
  BEFORE UPDATE ON public.partner_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_partner_task_updated_at();

CREATE OR REPLACE FUNCTION public.handle_crm_commercial_proposals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('aceite_comercial', 'aguardando_contrato_klasse') THEN
    NEW.accepted_at = coalesce(NEW.accepted_at, OLD.accepted_at, now());
  ELSE
    NEW.accepted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_commercial_proposals_updated_at ON public.crm_commercial_proposals;
CREATE TRIGGER trg_crm_commercial_proposals_updated_at
  BEFORE UPDATE ON public.crm_commercial_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_crm_commercial_proposals_updated_at();

ALTER TABLE public.partner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_commercial_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_tasks_super_admin" ON public.partner_tasks;
CREATE POLICY "partner_tasks_super_admin"
  ON public.partner_tasks
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "crm_commercial_proposals_super_admin" ON public.crm_commercial_proposals;
CREATE POLICY "crm_commercial_proposals_super_admin"
  ON public.crm_commercial_proposals
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

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
  created_at,
  updated_at,
  metadata
)
SELECT
  l.id,
  l.afiliado_codigo,
  l.membro_id,
  l.commercial_status,
  l.plano_estimado,
  coalesce(l.alunos_estimados, 0),
  coalesce(l.trial_days, 15),
  coalesce(l.taxa_ativacao, 0),
  l.mensalidade_kz,
  l.proposal_file_path,
  l.proposal_file_name,
  l.aceite_comercial_at,
  coalesce(l.created_at, now()),
  coalesce(l.commercial_status_updated_at, l.updated_at, now()),
  jsonb_build_object('source', 'backfill_from_crm_leads')
FROM public.crm_leads l
WHERE l.commercial_status IS NOT NULL
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
  proposal_file_path = EXCLUDED.proposal_file_path,
  proposal_file_name = EXCLUDED.proposal_file_name,
  accepted_at = EXCLUDED.accepted_at,
  updated_at = now(),
  metadata = public.crm_commercial_proposals.metadata || EXCLUDED.metadata;

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
  created_at,
  updated_at,
  metadata
)
SELECT
  l.afiliado_codigo,
  l.membro_id,
  coalesce(l.responsavel_membro_id, l.membro_id),
  l.id,
  l.onboarding_request_id,
  l.proxima_acao,
  'follow_up',
  'open',
  l.proxima_acao_data,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, now()),
  jsonb_build_object('source', 'backfill_from_crm_leads')
FROM public.crm_leads l
WHERE l.proxima_acao IS NOT NULL
  AND trim(l.proxima_acao) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_tasks t
    WHERE t.crm_lead_id = l.id
      AND t.task_type = 'follow_up'
      AND t.status = 'open'
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
            'commercial_proposal_id', proposal.id,
            'commercial_proposal_status', proposal.status,
            'commercial_proposal_accepted_at', proposal.accepted_at,
            'open_task_id', task.id,
            'open_task_due_at', task.due_at,
            'open_task_status', task.status,
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
        LEFT JOIN public.crm_commercial_proposals proposal
          ON proposal.crm_lead_id = l.id
        LEFT JOIN LATERAL (
          SELECT t.id, t.due_at, t.status
          FROM public.partner_tasks t
          WHERE t.crm_lead_id = l.id
            AND t.task_type = 'follow_up'
            AND t.status = 'open'
          ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC
          LIMIT 1
        ) task ON true
        WHERE l.afiliado_codigo = v_codigo_upper
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_crm_leads(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_action(uuid, text, uuid, text, timestamptz, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_commercial_terms(uuid, text, uuid, text, integer, integer, integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_influencer_crm_lead_proposal(uuid, text, uuid, text, text) TO anon, authenticated;

COMMIT;
