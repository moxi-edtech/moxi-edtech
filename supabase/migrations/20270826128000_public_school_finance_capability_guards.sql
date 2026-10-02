BEGIN;

-- ---------------------------------------------------------------------------
-- Public-school finance capability contract
--
-- Safe rollout rules:
--   tuition          => recurring tuition + one-off student payments
--   budget           => no transactional student finance
--   emoluments_only  => one-off student payments only
--   mixed            => one-off student payments only; recurring tuition is
--                       intentionally NOT inferred from this ambiguous label
--
-- Existing schools without an active profile keep the legacy "tuition"
-- fallback. This preserves compatibility while all provisioned schools are
-- expected to have an active school_operating_profiles row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.school_finance_model(
  p_school_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT p.finance_model
      FROM public.school_operating_profiles p
      WHERE p.school_id = p_school_id
        AND p.status = 'active'
        AND p.effective_from <= CURRENT_DATE
        AND (p.effective_until IS NULL OR p.effective_until >= CURRENT_DATE)
      ORDER BY p.effective_from DESC, p.created_at DESC
      LIMIT 1
    ),
    'tuition'
  );
$$;

CREATE OR REPLACE FUNCTION public.school_finance_allows_operation(
  p_school_id uuid,
  p_operation text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_model text := public.school_finance_model(p_school_id);
BEGIN
  RETURN CASE p_operation
    WHEN 'recurring_tuition' THEN v_model = 'tuition'
    WHEN 'financial_suspension' THEN v_model = 'tuition'
    WHEN 'finance_charge_message' THEN v_model = 'tuition'
    WHEN 'budget' THEN v_model = 'budget'
    WHEN 'emolument' THEN v_model IN ('tuition', 'emoluments_only', 'mixed')
    WHEN 'student_payment' THEN v_model IN ('tuition', 'emoluments_only', 'mixed')
    ELSE false
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_school_finance_operation(
  p_school_id uuid,
  p_operation text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_model text := public.school_finance_model(p_school_id);
BEGIN
  IF NOT public.school_finance_allows_operation(p_school_id, p_operation) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'FINANCE_MODEL_NOT_SUPPORTED',
      DETAIL = format('operation=%s finance_model=%s school_id=%s', p_operation, v_model, p_school_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.school_finance_model(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_finance_allows_operation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_school_finance_operation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_finance_model(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_finance_allows_operation(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_school_finance_operation(uuid, text) TO authenticated, service_role;

-- Enforce the institutional invariant at the table boundary. NOT VALID avoids
-- turning a historical bad row into a deployment outage, while still enforcing
-- the rule for every new/updated row.
ALTER TABLE public.school_operating_profiles
  DROP CONSTRAINT IF EXISTS school_operating_profiles_public_no_tuition_check;
ALTER TABLE public.school_operating_profiles
  ADD CONSTRAINT school_operating_profiles_public_no_tuition_check
  CHECK (NOT (school_sector = 'public' AND finance_model = 'tuition'))
  NOT VALID;

-- New recurring charges cannot be created for a model that does not support
-- tuition. Historical rows may still be cancelled/waived after a profile
-- change; only payment-like transitions are blocked.
CREATE OR REPLACE FUNCTION public.enforce_school_profile_on_mensalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_old_paid numeric := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.valor_pago_total, 0) ELSE 0 END;
  v_new_paid numeric := COALESCE(NEW.valor_pago_total, 0);
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_new_status text := lower(COALESCE(NEW.status, ''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.assert_school_finance_operation(NEW.escola_id, 'recurring_tuition');
  ELSIF v_new_paid > v_old_paid
     OR (v_old_status NOT IN ('pago', 'pago_parcial') AND v_new_status IN ('pago', 'pago_parcial')) THEN
    PERFORM public.assert_school_finance_operation(NEW.escola_id, 'recurring_tuition');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensalidades_school_profile_guard ON public.mensalidades;
CREATE TRIGGER trg_mensalidades_school_profile_guard
  BEFORE INSERT OR UPDATE OF status, valor_pago_total
  ON public.mensalidades
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_school_profile_on_mensalidade();

-- This trigger is the final writer boundary. It also covers direct legacy
-- inserts (e.g. gateway attempts) that do not go through the canonical RPC.
CREATE OR REPLACE FUNCTION public.enforce_school_profile_on_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status::text, '')) ELSE '' END;
  v_new_status text := lower(COALESCE(NEW.status::text, ''));
  v_operation text := CASE WHEN NEW.mensalidade_id IS NULL THEN 'student_payment' ELSE 'recurring_tuition' END;
  v_school_id uuid := NEW.escola_id;
BEGIN
  -- Alguns writers históricos informam apenas mensalidade_id. O guard não
  -- pode cair no fallback privado por ausência do escola_id no payload.
  IF v_school_id IS NULL AND NEW.mensalidade_id IS NOT NULL THEN
    SELECT m.escola_id INTO v_school_id
    FROM public.mensalidades m
    WHERE m.id = NEW.mensalidade_id;
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'FINANCE_SCHOOL_REQUIRED',
      DETAIL = 'Pagamento sem escola_id resolvível no boundary canónico.';
  END IF;

  IF TG_OP = 'INSERT'
     OR (v_old_status NOT IN ('settled', 'concluido') AND v_new_status IN ('settled', 'concluido')) THEN
    PERFORM public.assert_school_finance_operation(v_school_id, v_operation);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamentos_school_profile_guard ON public.pagamentos;
CREATE TRIGGER trg_pagamentos_school_profile_guard
  BEFORE INSERT OR UPDATE OF status
  ON public.pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_school_profile_on_pagamento();

COMMIT;
