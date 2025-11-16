-- Drop existing policy
DROP POLICY IF EXISTS unified_select_escola_usuarios ON public.escola_usuarios;

-- Create a new, more permissive policy for SELECT
CREATE POLICY unified_select_escola_usuarios ON public.escola_usuarios
  FOR SELECT
  USING (
    (check_super_admin_role()) OR
    (is_escola_member(escola_id))
  );
