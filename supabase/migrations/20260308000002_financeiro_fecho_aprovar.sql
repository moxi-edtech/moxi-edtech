BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_fecho_aprovar(
  p_escola_id uuid,
  p_fecho_id uuid,
  p_aprovacao text,
  p_justificativa text DEFAULT NULL,
  p_aprovacao_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.fecho_caixa
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_fecho public.fecho_caixa%ROWTYPE;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT user_has_role_in_school(p_escola_id, array['financeiro','admin','global_admin','super_admin']) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  v_status := CASE lower(coalesce(p_aprovacao, ''))
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'rejected'
  END;

  UPDATE public.fecho_caixa
  SET status = v_status,
      approved_by = auth.uid(),
      approved_at = now(),
      approval_note = p_justificativa,
      updated_at = now()
  WHERE id = p_fecho_id
    AND escola_id = p_escola_id
  RETURNING * INTO v_fecho;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fecho_not_found';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    auth.uid(),
    'FECHO_APROVADO',
    'fecho_caixa',
    p_fecho_id::text,
    'financeiro',
    jsonb_build_object(
      'status', v_status,
      'justificativa', p_justificativa,
      'meta', COALESCE(p_aprovacao_meta, '{}'::jsonb)
    )
  );

  RETURN v_fecho;
END;
$$;

COMMIT;
