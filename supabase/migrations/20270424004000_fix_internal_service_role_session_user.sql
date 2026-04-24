BEGIN;

CREATE OR REPLACE FUNCTION public.is_internal_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR session_user = 'service_role';
$$;

COMMENT ON FUNCTION public.is_internal_service_role()
IS 'True for trusted service_role context either via JWT role claim or direct DB service_role session.';

COMMIT;
