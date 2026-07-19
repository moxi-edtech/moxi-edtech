BEGIN;

CREATE OR REPLACE FUNCTION public.create_onboarding_doubt_by_token(
  p_token text,
  p_sender_name text,
  p_message text,
  p_step_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_token text := upper(trim(coalesce(p_token, '')));
  v_sender_name text := trim(coalesce(p_sender_name, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_step_code text := nullif(trim(coalesce(p_step_code, '')), '');
  v_onboarding_id uuid;
  v_rate_limit jsonb;
  v_doubt public.onboarding_doubts%ROWTYPE;
BEGIN
  IF length(v_token) < 16 OR length(v_token) > 128 THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;
  IF length(v_sender_name) < 2 OR length(v_sender_name) > 120 THEN
    RAISE EXCEPTION 'invalid_sender_name' USING ERRCODE = '22023';
  END IF;
  IF length(v_message) < 2 OR length(v_message) > 4000 THEN
    RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
  END IF;
  IF v_step_code IS NOT NULL AND length(v_step_code) > 80 THEN
    RAISE EXCEPTION 'invalid_step_code' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_onboarding_id
  FROM public.onboarding_requests
  WHERE tracking_token = v_token
  LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    RAISE EXCEPTION 'onboarding_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_rate_limit := public.check_public_rate_limit(
    'onboarding_doubt',
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    10,
    300,
    900
  );
  IF coalesce((v_rate_limit ->> 'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.onboarding_doubts (
    onboarding_id, sender_type, sender_name, message, step_code
  ) VALUES (
    v_onboarding_id, 'escola', v_sender_name, v_message, v_step_code
  )
  RETURNING * INTO v_doubt;

  RETURN to_jsonb(v_doubt);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_onboarding_doubt_by_token(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_onboarding_doubt_by_token(text, text, text, text)
  TO anon, authenticated, service_role;

COMMIT;
