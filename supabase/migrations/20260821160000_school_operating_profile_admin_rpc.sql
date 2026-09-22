BEGIN;

CREATE OR REPLACE FUNCTION public.set_school_operating_profile(
  p_school_id uuid,
  p_school_sector text,
  p_regulatory_profile text,
  p_finance_model text,
  p_assessment_policy text,
  p_document_profile text,
  p_effective_from date,
  p_reason text,
  p_confirm boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_current public.school_operating_profiles%ROWTYPE;
  v_new public.school_operating_profiles%ROWTYPE;
  v_action text;
  v_before jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_confirm IS NOT TRUE THEN
    RAISE EXCEPTION 'explicit confirmation is required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'profile change reason is required';
  END IF;

  IF p_effective_from IS NULL OR p_effective_from > CURRENT_DATE THEN
    RAISE EXCEPTION 'future effective dates are not enabled in this foundation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.escolas e WHERE e.id = p_school_id
  ) THEN
    RAISE EXCEPTION 'school not found';
  END IF;

  PERFORM 1
  FROM public.escolas e
  WHERE e.id = p_school_id
  FOR UPDATE;

  SELECT *
  INTO v_current
  FROM public.school_operating_profiles p
  WHERE p.school_id = p_school_id
    AND p.status = 'active'
  ORDER BY p.effective_from DESC
  LIMIT 1
  FOR UPDATE;

  v_before := CASE
    WHEN v_current.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'id', v_current.id,
      'school_id', v_current.school_id,
      'school_sector', v_current.school_sector,
      'regulatory_profile', v_current.regulatory_profile,
      'finance_model', v_current.finance_model,
      'assessment_policy', v_current.assessment_policy,
      'document_profile', v_current.document_profile,
      'effective_from', v_current.effective_from,
      'effective_until', v_current.effective_until,
      'status', v_current.status
    )
  END;

  IF v_current.id IS NOT NULL THEN
    UPDATE public.school_operating_profiles
    SET status = 'archived',
        effective_until = GREATEST(v_current.effective_from, p_effective_from - 1),
        updated_by = v_actor_id,
        updated_at = now()
    WHERE id = v_current.id;
  END IF;

  INSERT INTO public.school_operating_profiles (
    school_id,
    school_sector,
    regulatory_profile,
    finance_model,
    assessment_policy,
    document_profile,
    effective_from,
    status,
    created_by,
    updated_by
  )
  VALUES (
    p_school_id,
    p_school_sector,
    p_regulatory_profile,
    p_finance_model,
    p_assessment_policy,
    p_document_profile,
    p_effective_from,
    'active',
    v_actor_id,
    v_actor_id
  )
  RETURNING * INTO v_new;

  v_action := CASE WHEN v_current.id IS NULL THEN 'created' ELSE 'activated' END;

  PERFORM public.record_school_profile_audit(
    p_school_id,
    v_new.id,
    v_action,
    p_reason,
    v_before,
    jsonb_build_object(
      'id', v_new.id,
      'school_id', v_new.school_id,
      'school_sector', v_new.school_sector,
      'regulatory_profile', v_new.regulatory_profile,
      'finance_model', v_new.finance_model,
      'assessment_policy', v_new.assessment_policy,
      'document_profile', v_new.document_profile,
      'effective_from', v_new.effective_from,
      'effective_until', v_new.effective_until,
      'status', v_new.status
    ),
    v_new.effective_from
  );

  RETURN v_new.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_school_operating_profile(
  uuid, text, text, text, text, text, date, text, boolean
) TO authenticated, service_role;

COMMIT;
