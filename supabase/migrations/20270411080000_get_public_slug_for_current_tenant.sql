BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_slug_for_current_tenant(p_escola_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_escola_id uuid;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_escola_id IS NOT NULL THEN
    SELECT eu.escola_id
      INTO v_escola_id
      FROM public.escola_users eu
      JOIN public.escolas e ON e.id = eu.escola_id
     WHERE eu.user_id = v_user_id
       AND eu.escola_id = p_escola_id
       AND coalesce(e.tenant_type, '') IN ('formacao', 'solo_creator')
     ORDER BY eu.created_at DESC
     LIMIT 1;
  END IF;

  IF v_escola_id IS NULL THEN
    SELECT eu.escola_id
      INTO v_escola_id
      FROM public.escola_users eu
      JOIN public.escolas e ON e.id = eu.escola_id
     WHERE eu.user_id = v_user_id
       AND coalesce(e.tenant_type, '') IN ('formacao', 'solo_creator')
     ORDER BY eu.created_at DESC
     LIMIT 1;
  END IF;

  IF v_escola_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT e.slug
    INTO v_slug
    FROM public.escolas e
   WHERE e.id = v_escola_id;

  RETURN nullif(btrim(coalesce(v_slug, '')), '');
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_slug_for_current_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_slug_for_current_tenant(uuid) TO authenticated;

COMMIT;

