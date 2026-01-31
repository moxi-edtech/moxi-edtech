BEGIN;

DROP FUNCTION IF EXISTS public.preview_matricula_number(uuid);

CREATE OR REPLACE FUNCTION public.preview_matricula_number(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
  v_last bigint := 0;
BEGIN
  SELECT last_value
  INTO v_last
  FROM public.numero_counters
  WHERE escola_id = p_escola_id AND tipo = 'matricula';

  v_last := COALESCE(v_last, 0);
  RETURN GREATEST(v_last + 1, v_floor + 1, 1);
END;
$$;

ALTER FUNCTION public.preview_matricula_number(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.preview_matricula_number(uuid) TO authenticated, service_role;

COMMIT;
