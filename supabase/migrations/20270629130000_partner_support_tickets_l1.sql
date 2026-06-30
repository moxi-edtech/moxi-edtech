BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
  afiliado_codigo text NOT NULL,
  onboarding_request_id uuid REFERENCES public.onboarding_requests(id) ON DELETE SET NULL,
  escola_nome text NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp',
  categoria text NOT NULL DEFAULT 'operacional',
  gravidade text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'aberto',
  titulo text NOT NULL,
  descricao text,
  responsavel_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  criado_por_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  first_response_due_at timestamptz NOT NULL,
  resolution_due_at timestamptz NOT NULL,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_support_tickets_canal_check
    CHECK (canal IN ('whatsapp', 'telefone', 'email', 'presencial', 'portal', 'outro')),
  CONSTRAINT partner_support_tickets_categoria_check
    CHECK (categoria IN ('acesso', 'pagamentos', 'matriculas', 'notas', 'documentos', 'operacional', 'tecnico', 'outro')),
  CONSTRAINT partner_support_tickets_gravidade_check
    CHECK (gravidade IN ('alta', 'media', 'baixa')),
  CONSTRAINT partner_support_tickets_status_check
    CHECK (status IN ('aberto', 'em_atendimento', 'aguardando_cliente', 'escalado_klasse', 'resolvido'))
);

CREATE INDEX IF NOT EXISTS idx_partner_support_tickets_afiliado_status
  ON public.partner_support_tickets(afiliado_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_support_tickets_sla
  ON public.partner_support_tickets(afiliado_id, first_response_due_at, resolution_due_at)
  WHERE status <> 'resolvido';

CREATE INDEX IF NOT EXISTS idx_partner_support_tickets_responsavel
  ON public.partner_support_tickets(responsavel_membro_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_partner_support_ticket_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_support_tickets_updated_at ON public.partner_support_tickets;
CREATE TRIGGER trg_partner_support_tickets_updated_at
BEFORE UPDATE ON public.partner_support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.touch_partner_support_ticket_updated_at();

CREATE OR REPLACE FUNCTION public.partner_support_sla_interval(
  p_gravidade text,
  p_kind text
)
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT CASE lower(coalesce(p_gravidade, 'media'))
    WHEN 'alta' THEN CASE WHEN p_kind = 'first_response' THEN interval '15 minutes' ELSE interval '2 hours' END
    WHEN 'baixa' THEN CASE WHEN p_kind = 'first_response' THEN interval '4 hours' ELSE interval '24 hours' END
    ELSE CASE WHEN p_kind = 'first_response' THEN interval '1 hour' ELSE interval '8 hours' END
  END;
$$;

CREATE OR REPLACE FUNCTION public.require_influencer_active_session(
  p_session_id uuid,
  p_codigo text
)
RETURNS TABLE (
  afiliado_id uuid,
  codigo text,
  member_id uuid,
  member_name text,
  member_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);

  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS afiliado_id,
    a.codigo,
    m.id AS member_id,
    m.nome AS member_name,
    m.role AS member_role
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = (v_session->'session'->>'codigo')::text
    AND a.ativo = true
    AND m.id = (v_session->'session'->>'member_id')::uuid
    AND m.ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '28000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_influencer_support_tickets(
  p_session_id uuid,
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT *
    INTO v_session
  FROM public.require_influencer_active_session(p_session_id, p_codigo)
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'summary', (
      SELECT jsonb_build_object(
        'total', count(*),
        'open', count(*) FILTER (WHERE t.status <> 'resolvido'),
        'overdue_response', count(*) FILTER (
          WHERE t.status <> 'resolvido'
            AND t.first_responded_at IS NULL
            AND t.first_response_due_at < now()
        ),
        'overdue_resolution', count(*) FILTER (
          WHERE t.status <> 'resolvido'
            AND t.resolution_due_at < now()
        ),
        'escalated', count(*) FILTER (WHERE t.status = 'escalado_klasse'),
        'resolved', count(*) FILTER (WHERE t.status = 'resolvido')
      )
      FROM public.partner_support_tickets t
      WHERE t.afiliado_id = v_session.afiliado_id
    ),
    'tickets', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'onboarding_request_id', t.onboarding_request_id,
            'tracking_token', o.tracking_token,
            'escola_nome', t.escola_nome,
            'canal', t.canal,
            'categoria', t.categoria,
            'gravidade', t.gravidade,
            'status', t.status,
            'titulo', t.titulo,
            'descricao', t.descricao,
            'responsavel_membro_id', t.responsavel_membro_id,
            'responsavel_membro_nome', responsavel.nome,
            'criado_por_membro_id', t.criado_por_membro_id,
            'criado_por_membro_nome', criador.nome,
            'first_response_due_at', t.first_response_due_at,
            'resolution_due_at', t.resolution_due_at,
            'first_responded_at', t.first_responded_at,
            'resolved_at', t.resolved_at,
            'escalated_at', t.escalated_at,
            'escalation_reason', t.escalation_reason,
            'notes', t.notes,
            'created_at', t.created_at,
            'updated_at', t.updated_at
          )
          ORDER BY
            (t.status = 'resolvido') ASC,
            (t.resolution_due_at < now() AND t.status <> 'resolvido') DESC,
            t.created_at DESC
        )
        FROM public.partner_support_tickets t
        LEFT JOIN public.onboarding_requests o
          ON o.id = t.onboarding_request_id
        LEFT JOIN public.afiliado_membros responsavel
          ON responsavel.id = t.responsavel_membro_id
        LEFT JOIN public.afiliado_membros criador
          ON criador.id = t.criado_por_membro_id
        WHERE t.afiliado_id = v_session.afiliado_id
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_influencer_support_ticket(
  p_session_id uuid,
  p_codigo text,
  p_onboarding_token text DEFAULT NULL,
  p_escola_nome text DEFAULT NULL,
  p_canal text DEFAULT 'whatsapp',
  p_categoria text DEFAULT 'operacional',
  p_gravidade text DEFAULT 'media',
  p_titulo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_responsavel_membro_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session record;
  v_onboarding public.onboarding_requests%ROWTYPE;
  v_ticket_id uuid;
  v_responsavel_id uuid;
  v_escola_nome text := nullif(btrim(coalesce(p_escola_nome, '')), '');
  v_canal text := lower(btrim(coalesce(p_canal, 'whatsapp')));
  v_categoria text := lower(btrim(coalesce(p_categoria, 'operacional')));
  v_gravidade text := lower(btrim(coalesce(p_gravidade, 'media')));
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
BEGIN
  SELECT *
    INTO v_session
  FROM public.require_influencer_active_session(p_session_id, p_codigo)
  LIMIT 1;

  IF v_canal NOT IN ('whatsapp', 'telefone', 'email', 'presencial', 'portal', 'outro') THEN
    RAISE EXCEPTION 'invalid_channel' USING ERRCODE = '22023';
  END IF;

  IF v_categoria NOT IN ('acesso', 'pagamentos', 'matriculas', 'notas', 'documentos', 'operacional', 'tecnico', 'outro') THEN
    RAISE EXCEPTION 'invalid_category' USING ERRCODE = '22023';
  END IF;

  IF v_gravidade NOT IN ('alta', 'media', 'baixa') THEN
    RAISE EXCEPTION 'invalid_severity' USING ERRCODE = '22023';
  END IF;

  IF v_titulo IS NULL THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;

  IF nullif(btrim(coalesce(p_onboarding_token, '')), '') IS NOT NULL THEN
    SELECT *
      INTO v_onboarding
    FROM public.onboarding_requests
    WHERE tracking_token = btrim(p_onboarding_token)
      AND afiliado_id = v_session.afiliado_id
    LIMIT 1;

    IF v_onboarding.id IS NULL THEN
      RAISE EXCEPTION 'onboarding_not_found_or_access_denied' USING ERRCODE = 'P0002';
    END IF;

    v_escola_nome := v_onboarding.escola_nome;
  END IF;

  IF v_escola_nome IS NULL THEN
    RAISE EXCEPTION 'invalid_school' USING ERRCODE = '22023';
  END IF;

  v_responsavel_id := coalesce(p_responsavel_membro_id, v_session.member_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.afiliado_membros m
    WHERE m.id = v_responsavel_id
      AND m.afiliado_id = v_session.afiliado_id
      AND m.ativo = true
  ) THEN
    RAISE EXCEPTION 'responsavel_not_found_or_access_denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.partner_support_tickets (
    afiliado_id,
    afiliado_codigo,
    onboarding_request_id,
    escola_nome,
    canal,
    categoria,
    gravidade,
    titulo,
    descricao,
    responsavel_membro_id,
    criado_por_membro_id,
    first_response_due_at,
    resolution_due_at
  )
  VALUES (
    v_session.afiliado_id,
    v_session.codigo,
    v_onboarding.id,
    v_escola_nome,
    v_canal,
    v_categoria,
    v_gravidade,
    v_titulo,
    nullif(btrim(coalesce(p_descricao, '')), ''),
    v_responsavel_id,
    v_session.member_id,
    now() + public.partner_support_sla_interval(v_gravidade, 'first_response'),
    now() + public.partner_support_sla_interval(v_gravidade, 'resolution')
  )
  RETURNING id INTO v_ticket_id;

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
    v_session.member_id::text,
    'PARTNER_SUPPORT_TICKET_CREATED',
    'partner_support_tickets',
    v_ticket_id::text,
    jsonb_build_object(
      'codigo', v_session.codigo,
      'member_name', v_session.member_name,
      'escola_nome', v_escola_nome,
      'gravidade', v_gravidade,
      'categoria', v_categoria,
      'responsavel_membro_id', v_responsavel_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'ticket_id', v_ticket_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_influencer_support_ticket(
  p_session_id uuid,
  p_codigo text,
  p_ticket_id uuid,
  p_status text DEFAULT NULL,
  p_responsavel_membro_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_escalation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session record;
  v_ticket public.partner_support_tickets%ROWTYPE;
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_escalation_reason text := nullif(btrim(coalesce(p_escalation_reason, '')), '');
BEGIN
  SELECT *
    INTO v_session
  FROM public.require_influencer_active_session(p_session_id, p_codigo)
  LIMIT 1;

  SELECT *
    INTO v_ticket
  FROM public.partner_support_tickets
  WHERE id = p_ticket_id
    AND afiliado_id = v_session.afiliado_id
  LIMIT 1;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found_or_access_denied' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('aberto', 'em_atendimento', 'aguardando_cliente', 'escalado_klasse', 'resolvido') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  IF p_responsavel_membro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.afiliado_membros m
    WHERE m.id = p_responsavel_membro_id
      AND m.afiliado_id = v_session.afiliado_id
      AND m.ativo = true
  ) THEN
    RAISE EXCEPTION 'responsavel_not_found_or_access_denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.partner_support_tickets
  SET
    status = coalesce(v_status, status),
    responsavel_membro_id = coalesce(p_responsavel_membro_id, responsavel_membro_id),
    first_responded_at = CASE
      WHEN first_responded_at IS NULL
       AND coalesce(v_status, status) IN ('em_atendimento', 'aguardando_cliente', 'escalado_klasse', 'resolvido')
      THEN now()
      ELSE first_responded_at
    END,
    resolved_at = CASE
      WHEN coalesce(v_status, status) = 'resolvido' THEN coalesce(resolved_at, now())
      WHEN v_status IS NOT NULL AND v_status <> 'resolvido' THEN NULL
      ELSE resolved_at
    END,
    escalated_at = CASE
      WHEN coalesce(v_status, status) = 'escalado_klasse' THEN coalesce(escalated_at, now())
      ELSE escalated_at
    END,
    escalation_reason = CASE
      WHEN coalesce(v_status, status) = 'escalado_klasse' THEN coalesce(v_escalation_reason, escalation_reason)
      ELSE escalation_reason
    END,
    notes = CASE
      WHEN v_note IS NULL THEN notes
      WHEN notes IS NULL OR notes = '' THEN v_note
      ELSE notes || E'\n---\n' || v_note
    END
  WHERE id = p_ticket_id
    AND afiliado_id = v_session.afiliado_id;

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
    v_session.member_id::text,
    'PARTNER_SUPPORT_TICKET_UPDATED',
    'partner_support_tickets',
    p_ticket_id::text,
    jsonb_build_object(
      'codigo', v_session.codigo,
      'member_name', v_session.member_name,
      'previous_status', v_ticket.status,
      'next_status', coalesce(v_status, v_ticket.status),
      'responsavel_membro_id', coalesce(p_responsavel_membro_id, v_ticket.responsavel_membro_id),
      'note_added', v_note IS NOT NULL,
      'escalation_reason', v_escalation_reason
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_support_sla_interval(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_influencer_active_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_influencer_support_tickets(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_influencer_support_ticket(uuid, text, text, text, text, text, text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_support_ticket(uuid, text, uuid, text, uuid, text, text) TO anon, authenticated;

COMMIT;
