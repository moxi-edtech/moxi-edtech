BEGIN;
CREATE OR REPLACE FUNCTION public.appypay_confirm_payment(p_intent_id uuid)
RETURNS public.finance_payment_intents
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_intent public.finance_payment_intents;
  v_mensalidade public.mensalidades;
BEGIN
  SELECT * INTO v_intent FROM public.finance_payment_intents
  WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPYPAY_INTENT_NOT_FOUND'; END IF;
  IF coalesce(auth.role(), '') <> 'service_role'
    AND NOT coalesce(public.can_manage_school(v_intent.escola_id), false) THEN
    RAISE EXCEPTION 'APPYPAY_FORBIDDEN';
  END IF;
  IF v_intent.currency <> 'AOA' OR v_intent.method <> 'referencia'
    OR v_intent.amount <= 0
    OR v_intent.dedupe_key IS DISTINCT FROM ('appypay:' || v_intent.external_ref) THEN
    RAISE EXCEPTION 'APPYPAY_INTENT_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_references r
    JOIN public.school_payment_providers p ON p.id = r.provider_id AND p.school_id = r.school_id
    WHERE r.school_id = v_intent.escola_id AND r.obligation_id = v_intent.mensalidade_id
      AND r.provider_reference_id = v_intent.external_ref
      AND r.amount = v_intent.amount AND r.currency = 'AOA'
      AND p.provider_type = 'appypay' AND p.status = 'active'
  ) THEN RAISE EXCEPTION 'APPYPAY_REFERENCE_INVALID'; END IF;
  IF v_intent.status = 'confirmed' THEN RETURN v_intent; END IF;
  IF v_intent.status <> 'pending' THEN RAISE EXCEPTION 'APPYPAY_INTENT_INVALID'; END IF;
  SELECT * INTO v_mensalidade FROM public.mensalidades
  WHERE id = v_intent.mensalidade_id AND escola_id = v_intent.escola_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPYPAY_BALANCE_CHANGED'; END IF;
  IF v_mensalidade.status IN ('pago', 'isento', 'cancelado')
    OR round(coalesce(v_mensalidade.valor_previsto, v_mensalidade.valor, 0)
      - coalesce(v_mensalidade.valor_pago_total, 0), 2) <> round(v_intent.amount, 2) THEN
    RAISE EXCEPTION 'APPYPAY_BALANCE_CHANGED';
  END IF;
  RETURN public.finance_confirm_payment(p_intent_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.appypay_confirm_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appypay_confirm_payment(uuid) TO authenticated, service_role;
COMMIT;
