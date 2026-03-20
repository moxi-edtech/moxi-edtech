BEGIN;

CREATE POLICY escola_users_insert_super_admin
ON public.escola_users
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_super_admin_role()
);

COMMIT;
