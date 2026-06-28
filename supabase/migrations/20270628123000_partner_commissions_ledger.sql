BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  afiliado_codigo text NOT NULL,
  membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  onboarding_request_id uuid REFERENCES public.onboarding_requests(id) ON DELETE SET NULL,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  assinatura_id uuid REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  pagamento_saas_id uuid REFERENCES public.pagamentos_saas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('ativacao', 'recorrente')),
  base_valor_kz integer NOT NULL CHECK (base_valor_kz >= 0),
  percentual numeric(6, 4) NOT NULL DEFAULT 0.2500 CHECK (percentual >= 0 AND percentual <= 1),
  valor_kz integer NOT NULL CHECK (valor_kz >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked', 'paid', 'cancelled')),
  competencia_inicio date,
  competencia_fim date,
  due_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_commissions_super_admin_all ON public.partner_commissions;
CREATE POLICY partner_commissions_super_admin_all
  ON public.partner_commissions
  FOR ALL
  USING (public.check_super_admin_role());

CREATE UNIQUE INDEX IF NOT EXISTS ux_partner_commissions_pagamento_tipo
  ON public.partner_commissions (pagamento_saas_id, tipo)
  WHERE pagamento_saas_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_partner_commissions_afiliado_status
  ON public.partner_commissions (afiliado_codigo, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_partner_commissions_escola
  ON public.partner_commissions (escola_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_partner_commissions_updated ON public.partner_commissions;
CREATE TRIGGER trg_partner_commissions_updated
  BEFORE UPDATE ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_partner_commission_for_saas_payment(
  p_pagamento_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_payment public.pagamentos_saas%ROWTYPE;
  v_ass public.assinaturas%ROWTYPE;
  v_onboarding public.onboarding_requests%ROWTYPE;
  v_lead public.crm_leads%ROWTYPE;
  v_afiliado_id uuid;
  v_afiliado_codigo text;
  v_membro_id uuid;
  v_commission_id uuid;
  v_base integer;
  v_value integer;
BEGIN
  SELECT *
    INTO v_payment
  FROM public.pagamentos_saas
  WHERE id = p_pagamento_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;

  IF v_payment.status <> 'confirmado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_confirmed');
  END IF;

  SELECT *
    INTO v_ass
  FROM public.assinaturas
  WHERE id = v_payment.assinatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'subscription_not_found');
  END IF;

  SELECT *
    INTO v_onboarding
  FROM public.onboarding_requests
  WHERE escola_id = v_payment.escola_id
    AND (
      crm_lead_id IS NOT NULL
      OR financeiro->>'influencer_codigo' IS NOT NULL
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_partner_origin');
  END IF;

  IF v_onboarding.crm_lead_id IS NOT NULL THEN
    SELECT *
      INTO v_lead
    FROM public.crm_leads
    WHERE id = v_onboarding.crm_lead_id;
  END IF;

  v_afiliado_codigo := upper(trim(coalesce(v_lead.afiliado_codigo, v_onboarding.financeiro->>'influencer_codigo', '')));
  IF v_afiliado_codigo = '' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'missing_affiliate_code');
  END IF;

  SELECT id
    INTO v_afiliado_id
  FROM public.afiliados
  WHERE codigo = v_afiliado_codigo
    AND ativo = true
  LIMIT 1;

  IF v_afiliado_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'affiliate_not_found');
  END IF;

  v_membro_id := coalesce(v_lead.membro_id, nullif(v_onboarding.financeiro->>'converted_by_membro_id', '')::uuid);
  v_base := greatest(coalesce(v_payment.valor_kz, v_ass.valor_kz, 0), 0);
  v_value := round(v_base * 0.25)::integer;

  INSERT INTO public.partner_commissions (
    afiliado_id,
    afiliado_codigo,
    membro_id,
    escola_id,
    onboarding_request_id,
    crm_lead_id,
    assinatura_id,
    pagamento_saas_id,
    tipo,
    base_valor_kz,
    percentual,
    valor_kz,
    status,
    competencia_inicio,
    competencia_fim,
    due_at,
    metadata
  )
  VALUES (
    v_afiliado_id,
    v_afiliado_codigo,
    v_membro_id,
    v_payment.escola_id,
    v_onboarding.id,
    v_onboarding.crm_lead_id,
    v_ass.id,
    v_payment.id,
    'recorrente',
    v_base,
    0.2500,
    v_value,
    'pending',
    v_payment.periodo_inicio,
    v_payment.periodo_fim,
    now() + interval '7 days',
    jsonb_build_object(
      'source', 'pagamentos_saas',
      'generated_by', 'generate_partner_commission_for_saas_payment',
      'actor_id', p_actor_id,
      'payment_status', v_payment.status,
      'subscription_status', v_ass.status
    )
  )
  ON CONFLICT (pagamento_saas_id, tipo) WHERE pagamento_saas_id IS NOT NULL
  DO UPDATE SET
    base_valor_kz = EXCLUDED.base_valor_kz,
    valor_kz = EXCLUDED.valor_kz,
    metadata = partner_commissions.metadata || EXCLUDED.metadata
  RETURNING id INTO v_commission_id;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    acao,
    entity,
    entity_id,
    details
  )
  VALUES (
    v_payment.escola_id,
    coalesce(p_actor_id::text, 'system'),
    'PARTNER_COMMISSION_GENERATED',
    'partner_commissions',
    v_commission_id::text,
    jsonb_build_object(
      'afiliado_codigo', v_afiliado_codigo,
      'assinatura_id', v_ass.id,
      'pagamento_saas_id', v_payment.id,
      'base_valor_kz', v_base,
      'valor_kz', v_value,
      'percentual', 0.25
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'skipped', false,
    'commission_id', v_commission_id,
    'afiliado_codigo', v_afiliado_codigo,
    'base_valor_kz', v_base,
    'valor_kz', v_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_partner_commission_for_saas_payment(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_influencer_partner_commissions(
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
  v_codigo_upper text := upper(trim(coalesce(p_codigo, '')));
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'summary', coalesce((
      SELECT jsonb_build_object(
        'pending_kz', coalesce(sum(valor_kz) FILTER (WHERE status = 'pending'), 0),
        'approved_kz', coalesce(sum(valor_kz) FILTER (WHERE status = 'approved'), 0),
        'paid_kz', coalesce(sum(valor_kz) FILTER (WHERE status = 'paid'), 0),
        'blocked_kz', coalesce(sum(valor_kz) FILTER (WHERE status = 'blocked'), 0),
        'total_kz', coalesce(sum(valor_kz), 0),
        'count', count(*)
      )
      FROM public.partner_commissions
      WHERE afiliado_codigo = v_codigo_upper
    ), jsonb_build_object(
      'pending_kz', 0,
      'approved_kz', 0,
      'paid_kz', 0,
      'blocked_kz', 0,
      'total_kz', 0,
      'count', 0
    )),
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pc.id,
          'tipo', pc.tipo,
          'status', pc.status,
          'base_valor_kz', pc.base_valor_kz,
          'percentual', pc.percentual,
          'valor_kz', pc.valor_kz,
          'competencia_inicio', pc.competencia_inicio,
          'competencia_fim', pc.competencia_fim,
          'due_at', pc.due_at,
          'created_at', pc.created_at,
          'escola_nome', e.nome,
          'assinatura_id', pc.assinatura_id,
          'pagamento_saas_id', pc.pagamento_saas_id
        )
        ORDER BY pc.created_at DESC
      )
      FROM (
        SELECT *
        FROM public.partner_commissions
        WHERE afiliado_codigo = v_codigo_upper
        ORDER BY created_at DESC
        LIMIT 50
      ) pc
      LEFT JOIN public.escolas e
        ON e.id = pc.escola_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_partner_commissions(uuid, text) TO anon, authenticated;

COMMIT;
