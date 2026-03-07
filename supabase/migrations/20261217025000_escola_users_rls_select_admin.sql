BEGIN;

DROP POLICY IF EXISTS escola_users_select_v3 ON public.escola_users;
CREATE POLICY escola_users_select_v3
ON public.escola_users
FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    escola_id = current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','secretaria','staff_admin']::text[]
    )
  )
  OR public.check_super_admin_role()
);

COMMIT;
