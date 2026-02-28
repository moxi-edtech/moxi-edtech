CREATE OR REPLACE FUNCTION public.check_super_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.current_user_role() IN ('super_admin', 'global_admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('super_admin', 'global_admin')
    );
END;
$$;
