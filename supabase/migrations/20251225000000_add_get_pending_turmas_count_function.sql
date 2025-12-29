CREATE OR REPLACE FUNCTION public.get_pending_turmas_count(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.turmas
  WHERE escola_id = p_escola_id AND status_validacao = 'rascunho';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_turmas_count(uuid) TO authenticated, service_role;