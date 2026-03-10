BEGIN;

CREATE OR REPLACE FUNCTION public.matricula_counter_floor(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_floor bigint := 0;
BEGIN
  v_floor := GREATEST(
    COALESCE((
      SELECT MAX(cleaned::bigint)
      FROM (
        SELECT NULLIF(regexp_replace(m.numero_matricula::text, '[^0-9]', '', 'g'), '') AS cleaned
        FROM public.matriculas m
        WHERE m.escola_id = p_escola_id
      ) src
      WHERE cleaned ~ '^\d+$' AND length(cleaned) <= 18
    ), 0),
    COALESCE((
      SELECT MAX(cleaned::bigint)
      FROM (
        SELECT NULLIF(regexp_replace(p.numero_login::text, '[^0-9]', '', 'g'), '') AS cleaned
        FROM public.profiles p
        WHERE p.numero_login IS NOT NULL AND p.escola_id = p_escola_id
      ) src
      WHERE cleaned ~ '^\d+$' AND length(cleaned) <= 18
    ), 0),
    COALESCE((
      SELECT MAX(cleaned::bigint)
      FROM (
        SELECT NULLIF(regexp_replace(p2.numero_login::text, '[^0-9]', '', 'g'), '') AS cleaned
        FROM public.profiles p2
        WHERE p2.numero_login IS NOT NULL
      ) src
      WHERE cleaned ~ '^\d+$' AND length(cleaned) <= 18
    ), 0)
  );

  RETURN v_floor;
END;
$$;

COMMIT;
