BEGIN;

DROP POLICY IF EXISTS escola_users_insert ON public.escola_users;

CREATE POLICY escola_users_insert
ON public.escola_users
FOR INSERT
TO authenticated
WITH CHECK (
  check_super_admin_role()
  OR escola_id = current_escola_id()
  OR user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria'])
);

COMMIT;
