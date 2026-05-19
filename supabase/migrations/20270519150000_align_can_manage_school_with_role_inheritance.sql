CREATE OR REPLACE FUNCTION public.can_manage_school(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin()
    OR public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'admin',
        'admin_escola',
        'staff_admin',
        'secretaria',
        'secretario',
        'financeiro'
      ]::text[]
    );
$$;
