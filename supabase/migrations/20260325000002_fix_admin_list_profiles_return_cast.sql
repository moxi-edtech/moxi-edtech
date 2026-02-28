CREATE OR REPLACE FUNCTION public.admin_list_profiles(
  p_roles text[],
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_login text,
  escola_id uuid,
  current_escola_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role::text,
    p.numero_login,
    p.escola_id,
    p.current_escola_id
  FROM public.profiles p
  WHERE p.role::text = ANY(p_roles)
    AND p.deleted_at IS NULL
  ORDER BY p.nome NULLS LAST, p.user_id DESC
  LIMIT COALESCE(p_limit, 5000);
END;
$$;
