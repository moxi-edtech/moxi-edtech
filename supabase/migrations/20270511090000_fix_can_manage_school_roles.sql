CREATE OR REPLACE FUNCTION public.can_manage_school(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
        AND p.role IN ('admin', 'admin_escola', 'staff_admin', 'secretaria', 'financeiro')
        AND p.deleted_at IS NULL
    );
$$;
