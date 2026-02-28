CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'pg_temp'
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    current_setting('request.jwt.claims', true)::jsonb ->> 'user_role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.check_super_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_temp'
AS $$
BEGIN
  RETURN public.current_user_role() IN ('super_admin', 'global_admin');
END;
$$;
