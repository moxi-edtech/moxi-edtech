BEGIN;

CREATE POLICY profiles_insert_super_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_super_admin_role()
);

COMMIT;
