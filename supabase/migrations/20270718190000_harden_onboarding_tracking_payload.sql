BEGIN;

CREATE OR REPLACE FUNCTION public.get_onboarding_tracking_payload(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_token text := upper(trim(coalesce(p_token, '')));
  v_request jsonb;
  v_onboarding_id uuid;
  v_steps jsonb;
  v_uploads jsonb;
  v_rate_limit jsonb;
BEGIN
  IF v_token !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado');
  END IF;

  v_rate_limit := public.check_public_rate_limit(
    'onboarding_tracking_payload', md5(v_token), 60, 300, 600
  );
  IF NOT coalesce((v_rate_limit->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT r.id,
         jsonb_build_object(
           'id', r.id,
           'escola_nome', r.escola_nome,
           'escola_id', r.escola_id,
           'tracking_token', r.tracking_token,
           'status', r.status
         )
    INTO v_onboarding_id, v_request
  FROM public.onboarding_requests r
  WHERE r.tracking_token = v_token
  LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado');
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'id', s.id,
      'step_code', s.step_code,
      'title', s.title,
      'status', s.status,
      'owner_type', s.owner_type,
      'sla_days', s.sla_days,
      'deadline_at', s.deadline_at,
      'completed_at', s.completed_at
    ) ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC),
    '[]'::jsonb
  ) INTO v_steps
  FROM public.onboarding_steps s
  WHERE s.onboarding_id = v_onboarding_id;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'id', u.id,
      'step_code', u.step_code,
      'file_path', u.file_path,
      'status', u.status,
      'rejection_reason', u.rejection_reason,
      'partner_review_note', u.partner_review_note,
      'document_type', u.document_type,
      'created_by', u.created_by,
      'created_at', u.created_at
    ) ORDER BY u.created_at DESC),
    '[]'::jsonb
  ) INTO v_uploads
  FROM public.onboarding_uploads u
  WHERE u.onboarding_id = v_onboarding_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request', v_request,
    'steps', v_steps,
    'uploads', v_uploads
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_tracking_payload(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_tracking_payload(text) TO anon, authenticated, service_role;

COMMIT;
