BEGIN;

CREATE OR REPLACE FUNCTION public.formacao_formadores_por_centro(
  p_escola_id uuid
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'p_escola_id é obrigatório';
  END IF;

  IF auth.role() <> 'service_role'
    AND NOT public.is_super_or_global_admin()
    AND NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['formacao_admin', 'formacao_secretaria', 'formacao_financeiro']::text[]
    )
  THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    eu.user_id,
    COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.email), ''), 'Formador') AS nome,
    p.email
  FROM public.escola_users eu
  LEFT JOIN public.profiles p ON p.user_id = eu.user_id
  WHERE eu.escola_id = p_escola_id
    AND eu.tenant_type = 'formacao'
    AND eu.papel = 'formador'
    AND COALESCE(p.deleted_at, '-infinity'::timestamptz) = '-infinity'::timestamptz
  ORDER BY COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.email), ''), 'Formador'), eu.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_formadores_por_centro(uuid) TO authenticated, service_role;

COMMIT;
