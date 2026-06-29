BEGIN;

ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS acceptance_term_file_path text,
  ADD COLUMN IF NOT EXISTS acceptance_signed_by text,
  ADD COLUMN IF NOT EXISTS acceptance_signed_role text,
  ADD COLUMN IF NOT EXISTS acceptance_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS acceptance_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS acceptance_validated_by uuid,
  ADD COLUMN IF NOT EXISTS acceptance_notes text;

COMMENT ON COLUMN public.onboarding_requests.acceptance_term_file_path IS
  'Caminho do Termo de Aceite assinado no bucket de onboarding.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_by IS
  'Nome do diretor/signatário que assinou o Termo de Aceite.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_role IS
  'Cargo do signatário do Termo de Aceite.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_at IS
  'Data de assinatura declarada no Termo de Aceite.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_validated_at IS
  'Data em que a KLASSE validou o Termo de Aceite.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_validated_by IS
  'Utilizador KLASSE que validou o Termo de Aceite.';
COMMENT ON COLUMN public.onboarding_requests.acceptance_notes IS
  'Notas internas da validação do Termo de Aceite.';

CREATE OR REPLACE FUNCTION public.onboarding_implantation_checklist_complete(
  p_items jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT
    coalesce(jsonb_array_length(p_items), 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
      WHERE coalesce((item->>'completed')::boolean, false) = false
    );
$$;

CREATE OR REPLACE FUNCTION public.validate_onboarding_implantation_acceptance(
  p_request_id uuid,
  p_acceptance_term_file_path text,
  p_acceptance_signed_by text,
  p_acceptance_signed_at timestamptz,
  p_actor_id uuid DEFAULT NULL,
  p_acceptance_signed_role text DEFAULT NULL,
  p_acceptance_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request public.onboarding_requests%ROWTYPE;
  v_file_path text := nullif(btrim(coalesce(p_acceptance_term_file_path, '')), '');
  v_signed_by text := nullif(btrim(coalesce(p_acceptance_signed_by, '')), '');
  v_signed_role text := nullif(btrim(coalesce(p_acceptance_signed_role, '')), '');
  v_notes text := nullif(btrim(coalesce(p_acceptance_notes, '')), '');
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND coalesce(public.check_super_admin_role(), false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT *
    INTO v_request
  FROM public.onboarding_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
  END IF;

  IF public.onboarding_implantation_checklist_complete(v_request.implantation_checklist) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'checklist_incomplete');
  END IF;

  IF v_file_path IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'acceptance_term_required');
  END IF;

  IF v_signed_by IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signed_by_required');
  END IF;

  IF p_acceptance_signed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signed_at_required');
  END IF;

  UPDATE public.onboarding_requests
  SET
    implantation_status = 'aceite_validado',
    acceptance_term_file_path = v_file_path,
    acceptance_signed_by = v_signed_by,
    acceptance_signed_role = v_signed_role,
    acceptance_signed_at = p_acceptance_signed_at,
    acceptance_validated_at = now(),
    acceptance_validated_by = p_actor_id,
    acceptance_notes = v_notes
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  UPDATE public.partner_commissions
  SET
    metadata = metadata || jsonb_build_object(
      'acceptance_validated_at', v_request.acceptance_validated_at,
      'acceptance_term_file_path', v_file_path
    )
  WHERE onboarding_request_id = v_request.id
    AND tipo = 'ativacao';

  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    acao,
    tabela,
    registro_id,
    entity,
    entity_id,
    details
  )
  VALUES (
    v_request.escola_id,
    'super_admin',
    'ONBOARDING_ACCEPTANCE_VALIDATED',
    'onboarding_requests',
    v_request.id::text,
    'onboarding_requests',
    v_request.id::text,
    jsonb_build_object(
      'actor_id', p_actor_id,
      'acceptance_term_file_path', v_file_path,
      'acceptance_signed_by', v_signed_by,
      'acceptance_signed_role', v_signed_role,
      'acceptance_signed_at', p_acceptance_signed_at
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'onboarding_request_id', v_request.id,
    'implantation_status', v_request.implantation_status,
    'acceptance_validated_at', v_request.acceptance_validated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_activation_commission_acceptance_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_acceptance_ok boolean := false;
BEGIN
  IF NEW.tipo <> 'ativacao' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT
    r.implantation_status = 'aceite_validado'
    AND r.acceptance_term_file_path IS NOT NULL
    AND r.acceptance_signed_by IS NOT NULL
    AND r.acceptance_signed_at IS NOT NULL
    AND public.onboarding_implantation_checklist_complete(r.implantation_checklist)
  INTO v_acceptance_ok
  FROM public.onboarding_requests r
  WHERE r.id = NEW.onboarding_request_id;

  IF coalesce(v_acceptance_ok, false) = false THEN
    RAISE EXCEPTION 'Comissão de ativação bloqueada: Termo de Aceite validado é obrigatório.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activation_commission_acceptance_gate ON public.partner_commissions;
CREATE TRIGGER trg_activation_commission_acceptance_gate
  BEFORE INSERT OR UPDATE OF status, onboarding_request_id, tipo
  ON public.partner_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_activation_commission_acceptance_gate();

GRANT EXECUTE ON FUNCTION public.onboarding_implantation_checklist_complete(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_onboarding_implantation_acceptance(uuid, text, text, timestamptz, uuid, text, text) TO authenticated, service_role;

COMMIT;
