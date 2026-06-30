BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  afiliado_codigo text NOT NULL,
  requested_by_membro_id uuid REFERENCES public.afiliado_membros(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'paid', 'rejected', 'cancelled')),
  total_kz integer NOT NULL DEFAULT 0 CHECK (total_kz >= 0),
  receipt_file_path text NOT NULL,
  receipt_file_name text NOT NULL,
  receipt_file_type text,
  receipt_file_size integer CHECK (receipt_file_size IS NULL OR receipt_file_size >= 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.partner_commission_payout_items (
  payout_id uuid NOT NULL REFERENCES public.partner_commission_payouts(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.partner_commissions(id) ON DELETE RESTRICT,
  valor_kz integer NOT NULL CHECK (valor_kz >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payout_id, commission_id)
);

ALTER TABLE public.partner_commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commission_payout_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_commission_payouts_super_admin_all ON public.partner_commission_payouts;
CREATE POLICY partner_commission_payouts_super_admin_all
  ON public.partner_commission_payouts
  FOR ALL
  USING (public.check_super_admin_role());

DROP POLICY IF EXISTS partner_commission_payout_items_super_admin_all ON public.partner_commission_payout_items;
CREATE POLICY partner_commission_payout_items_super_admin_all
  ON public.partner_commission_payout_items
  FOR ALL
  USING (public.check_super_admin_role());

CREATE UNIQUE INDEX IF NOT EXISTS ux_partner_commission_payout_items_active
  ON public.partner_commission_payout_items (commission_id);

CREATE INDEX IF NOT EXISTS ix_partner_commission_payouts_afiliado_status
  ON public.partner_commission_payouts (afiliado_codigo, status, requested_at DESC);

DROP TRIGGER IF EXISTS trg_partner_commission_payouts_updated ON public.partner_commission_payouts;
CREATE TRIGGER trg_partner_commission_payouts_updated
  BEFORE UPDATE ON public.partner_commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_influencer_partner_commission_payout(
  p_session_id uuid,
  p_codigo text,
  p_commission_ids uuid[],
  p_receipt_file_path text,
  p_receipt_file_name text,
  p_receipt_file_type text DEFAULT NULL,
  p_receipt_file_size integer DEFAULT NULL
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
  v_afiliado_id uuid;
  v_payout_id uuid;
  v_total integer := 0;
  v_count integer := 0;
  v_requested_ids uuid[];
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;

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

  v_requested_ids := ARRAY(
    SELECT DISTINCT unnest(coalesce(p_commission_ids, ARRAY[]::uuid[]))
  );

  IF array_length(v_requested_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_commissions_selected');
  END IF;

  IF nullif(trim(coalesce(p_receipt_file_path, '')), '') IS NULL
     OR nullif(trim(coalesce(p_receipt_file_name, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receipt_required');
  END IF;

  SELECT count(*), coalesce(sum(pc.valor_kz), 0)::integer
    INTO v_count, v_total
  FROM public.partner_commissions pc
  WHERE pc.id = ANY(v_requested_ids)
    AND pc.afiliado_codigo = v_codigo_upper
    AND pc.afiliado_id = v_afiliado_id
    AND pc.status = 'approved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.partner_commission_payout_items pi
      JOIN public.partner_commission_payouts po
        ON po.id = pi.payout_id
      WHERE pi.commission_id = pc.id
        AND po.status IN ('requested', 'approved', 'paid')
    );

  IF v_count <> array_length(v_requested_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'commission_not_available_for_payout');
  END IF;

  INSERT INTO public.partner_commission_payouts (
    afiliado_id,
    afiliado_codigo,
    requested_by_membro_id,
    status,
    total_kz,
    receipt_file_path,
    receipt_file_name,
    receipt_file_type,
    receipt_file_size,
    metadata
  )
  VALUES (
    v_afiliado_id,
    v_codigo_upper,
    v_member_id,
    'requested',
    v_total,
    p_receipt_file_path,
    p_receipt_file_name,
    p_receipt_file_type,
    p_receipt_file_size,
    jsonb_build_object(
      'requested_by_member_name', coalesce(v_session->'session'->>'member_name', 'Parceiro'),
      'commission_count', v_count
    )
  )
  RETURNING id INTO v_payout_id;

  INSERT INTO public.partner_commission_payout_items (payout_id, commission_id, valor_kz)
  SELECT v_payout_id, pc.id, pc.valor_kz
  FROM public.partner_commissions pc
  WHERE pc.id = ANY(v_requested_ids);

  UPDATE public.partner_commissions pc
  SET metadata = pc.metadata || jsonb_build_object(
      'payout_id', v_payout_id,
      'payout_status', 'requested',
      'payout_requested_at', now()
    )
  WHERE pc.id = ANY(v_requested_ids);

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
    'PARTNER_PAYOUT_REQUESTED',
    'partner_commission_payouts',
    v_payout_id::text,
    jsonb_build_object(
      'afiliado_codigo', v_codigo_upper,
      'total_kz', v_total,
      'commission_count', v_count,
      'receipt_file_name', p_receipt_file_name
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', v_payout_id,
    'status', 'requested',
    'total_kz', v_total,
    'commission_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_influencer_partner_commission_payout(
  uuid, text, uuid[], text, text, text, integer
) TO anon, authenticated;

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
        'requested_payout_kz', coalesce(sum(valor_kz) FILTER (
          WHERE status = 'approved'
            AND (metadata->>'payout_status') = 'requested'
        ), 0),
        'available_payout_kz', coalesce(sum(valor_kz) FILTER (
          WHERE status = 'approved'
            AND coalesce(metadata->>'payout_status', '') = ''
        ), 0),
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
      'requested_payout_kz', 0,
      'available_payout_kz', 0,
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
          'payout_id', pc.metadata->>'payout_id',
          'payout_status', pc.metadata->>'payout_status',
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
    ), '[]'::jsonb),
    'payouts', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', po.id,
          'status', po.status,
          'total_kz', po.total_kz,
          'receipt_file_name', po.receipt_file_name,
          'requested_at', po.requested_at,
          'approved_at', po.approved_at,
          'paid_at', po.paid_at,
          'commission_count', (
            SELECT count(*)
            FROM public.partner_commission_payout_items pi
            WHERE pi.payout_id = po.id
          )
        )
        ORDER BY po.requested_at DESC
      )
      FROM (
        SELECT *
        FROM public.partner_commission_payouts
        WHERE afiliado_codigo = v_codigo_upper
        ORDER BY requested_at DESC
        LIMIT 20
      ) po
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_partner_commissions(uuid, text) TO anon, authenticated;

COMMIT;
