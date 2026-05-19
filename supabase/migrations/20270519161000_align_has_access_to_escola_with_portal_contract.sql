BEGIN;

CREATE OR REPLACE FUNCTION public.has_access_to_escola(_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.check_super_admin_role()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.current_escola_id = _escola_id OR p.escola_id = _escola_id)
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.escola_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.escola_id = _escola_id
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.escola_administradores ea
      WHERE ea.user_id = auth.uid()
        AND ea.escola_id = _escola_id
      LIMIT 1
    );
$$;

COMMIT;
