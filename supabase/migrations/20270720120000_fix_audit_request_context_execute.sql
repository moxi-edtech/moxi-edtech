-- Fix balcão pagamentos failure caused by audit trigger invoking audit_request_context
-- as the authenticated request role.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_request_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  headers jsonb;
  claims jsonb;
  ip text;
  ua text;
  role text;
BEGIN
  headers := NULL;
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN others THEN
    headers := NULL;
  END;

  claims := NULL;
  BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN others THEN
    claims := NULL;
  END;

  ip := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
  ua := headers->>'user-agent';
  role := COALESCE(claims->>'user_role', claims->>'role');

  RETURN jsonb_build_object('ip', ip, 'user_agent', ua, 'actor_role', role);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_request_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_request_context() TO anon, authenticated, service_role;

COMMIT;
