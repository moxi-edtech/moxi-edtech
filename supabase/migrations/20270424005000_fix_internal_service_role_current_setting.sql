BEGIN;

CREATE OR REPLACE FUNCTION public.is_internal_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR COALESCE(current_setting('role', true), '') = 'service_role';
$$;

COMMENT ON FUNCTION public.is_internal_service_role()
IS 'True for trusted service_role context via JWT claim or SQL role context (SET ROLE service_role).';

COMMIT;
