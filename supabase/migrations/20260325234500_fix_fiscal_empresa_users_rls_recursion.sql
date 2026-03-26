BEGIN;

DROP POLICY IF EXISTS fiscal_empresa_users_select ON public.fiscal_empresa_users;
CREATE POLICY fiscal_empresa_users_select
ON public.fiscal_empresa_users
FOR SELECT
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(
    fiscal_empresa_users.empresa_id,
    ARRAY['owner','admin','operator','auditor']
  )
);

COMMIT;
