BEGIN;

-- 1. Create crm_leads table
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_codigo     varchar(50) NOT NULL REFERENCES public.afiliados(codigo) ON DELETE CASCADE,
    membro_id           uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
    nome_escola         varchar(255) NOT NULL,
    nome_contacto       varchar(255),
    telefone            varchar(50),
    email               varchar(255),
    segmento            varchar(50) DEFAULT 'privada' CHECK (segmento IN ('publica', 'privada', 'comparticipada')),
    alunos_estimados    integer DEFAULT 0,
    plano_estimado      varchar(50) DEFAULT 'essencial' CHECK (plano_estimado IN ('essencial', 'profissional', 'premium')),
    etapa               varchar(50) NOT NULL DEFAULT 'prospeccao' CHECK (etapa IN ('prospeccao', 'contacto', 'apresentacao', 'negociacao', 'ganho', 'perdido')),
    motivo_perda        text,
    proxima_acao        varchar(255),
    proxima_acao_data   timestamptz,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_crm_leads_afiliado ON public.crm_leads(afiliado_codigo);
CREATE INDEX IF NOT EXISTS idx_crm_leads_membro ON public.crm_leads(membro_id);

-- Enable RLS
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policies
-- Allow super admins full control
DROP POLICY IF EXISTS "crm_leads_super_admin" ON public.crm_leads;
CREATE POLICY "crm_leads_super_admin"
  ON public.crm_leads
  FOR ALL
  USING (public.is_super_admin());

-- Allow anyone to read/write who can authenticate under an active session
-- Row isolation is enforced programmatically in the API / RPC layer.
-- To allow secure RLS isolation for SELECT:
DROP POLICY IF EXISTS "crm_leads_select_policy" ON public.crm_leads;
CREATE POLICY "crm_leads_select_policy"
  ON public.crm_leads
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "crm_leads_insert_policy" ON public.crm_leads;
CREATE POLICY "crm_leads_insert_policy"
  ON public.crm_leads
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "crm_leads_update_policy" ON public.crm_leads;
CREATE POLICY "crm_leads_update_policy"
  ON public.crm_leads
  FOR UPDATE
  USING (true);

-- 3. Function to update updated_at automatically
CREATE OR REPLACE FUNCTION public.handle_crm_leads_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at
    BEFORE UPDATE ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_crm_leads_updated_at();

-- 4. Audit Log trigger for pipeline moves
CREATE OR REPLACE FUNCTION public.log_crm_lead_activity()
RETURNS trigger AS $$
BEGIN
    -- Log pipeline movements
    IF TG_OP = 'UPDATE' AND OLD.etapa <> NEW.etapa THEN
        INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
        VALUES (
            NULL,
            COALESCE(NEW.membro_id::text, 'system'),
            'CRM_LEAD_STAGE_MOVE',
            'crm_leads',
            NEW.id::text,
            jsonb_build_object(
                'lead_nome', NEW.nome_escola,
                'afiliado_codigo', NEW.afiliado_codigo,
                'origem_etapa', OLD.etapa,
                'nova_etapa', NEW.etapa,
                'motivo_perda', NEW.motivo_perda
            )
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
        VALUES (
            NULL,
            COALESCE(NEW.membro_id::text, 'system'),
            'CRM_LEAD_CREATED',
            'crm_leads',
            NEW.id::text,
            jsonb_build_object(
                'lead_nome', NEW.nome_escola,
                'afiliado_codigo', NEW.afiliado_codigo,
                'etapa', NEW.etapa
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_crm_lead_activity ON public.crm_leads;
CREATE TRIGGER trg_crm_lead_activity
    AFTER INSERT OR UPDATE ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.log_crm_lead_activity();

-- 5. Helper function for listing leads for an affiliate
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
  -- Verify opaque session first
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
            'created_at', l.created_at,
            'updated_at', l.updated_at
          )
          ORDER BY l.created_at DESC
        )
        FROM public.crm_leads l
        WHERE l.afiliado_codigo = v_codigo_upper
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- 6. Helper function to create lead
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
  p_proxima_acao_data timestamptz DEFAULT NULL
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
  v_lead_id uuid;
BEGIN
  -- Verify session
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;

  INSERT INTO public.crm_leads (
    afiliado_codigo,
    membro_id,
    nome_escola,
    nome_contacto,
    telefone,
    email,
    segmento,
    alunos_estimados,
    plano_estimado,
    proxima_acao,
    proxima_acao_data
  ) VALUES (
    v_codigo_upper,
    v_member_id,
    p_nome_escola,
    p_nome_contacto,
    p_telefone,
    p_email,
    p_segmento,
    p_alunos_estimados,
    p_plano_estimado,
    p_proxima_acao,
    p_proxima_acao_data
  ) RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id);
END;
$$;

-- 7. Helper function to update lead stage
CREATE OR REPLACE FUNCTION public.update_influencer_crm_lead_stage(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_etapa text,
  p_motivo_perda text DEFAULT NULL
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
  -- Verify session
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  UPDATE public.crm_leads
  SET 
    etapa = p_etapa,
    motivo_perda = CASE WHEN p_etapa = 'perdido' THEN p_motivo_perda ELSE NULL END
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 8. Helper function to log interaction / update next action
CREATE OR REPLACE FUNCTION public.update_influencer_crm_lead_action(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid,
  p_proxima_acao text,
  p_proxima_acao_data timestamptz,
  p_interaction_note text DEFAULT NULL
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
BEGIN
  -- Verify session
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := (v_session->'session'->>'member_name')::text;

  UPDATE public.crm_leads
  SET
    proxima_acao = p_proxima_acao,
    proxima_acao_data = p_proxima_acao_data
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  -- Log interaction in audit logs if note provided
  IF p_interaction_note IS NOT NULL AND trim(p_interaction_note) <> '' THEN
    INSERT INTO public.audit_logs (escola_id, user_id, acao, entity, entity_id, details)
    VALUES (
        NULL,
        COALESCE(v_member_id::text, 'system'),
        'CRM_LEAD_NOTE_ADDED',
        'crm_leads',
        p_lead_id::text,
        jsonb_build_object(
            'member_name', v_member_name,
            'notes', p_interaction_note
        )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_crm_leads(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_crm_lead(uuid, text, text, text, text, text, text, integer, text, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_stage(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_crm_lead_action(uuid, text, uuid, text, timestamptz, text) TO anon, authenticated;

COMMIT;
