BEGIN;

DROP POLICY IF EXISTS profiles_service_role_all ON public.profiles;
CREATE POLICY profiles_service_role_all
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS escola_users_service_role_all ON public.escola_users;
CREATE POLICY escola_users_service_role_all
ON public.escola_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;
