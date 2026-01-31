BEGIN;

CREATE TABLE IF NOT EXISTS public.numero_counters (
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (escola_id, tipo)
);

ALTER TABLE public.numero_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select ON public.numero_counters;
CREATE POLICY tenant_select ON public.numero_counters
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_insert ON public.numero_counters;
CREATE POLICY tenant_insert ON public.numero_counters
  FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS tenant_update ON public.numero_counters;
CREATE POLICY tenant_update ON public.numero_counters
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE OR REPLACE FUNCTION public.next_numero_counter(
  p_escola_id uuid,
  p_tipo text,
  p_start bigint DEFAULT 1
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.numero_counters (escola_id, tipo, last_value, updated_at)
  VALUES (p_escola_id, p_tipo, GREATEST(p_start - 1, 0), now())
  ON CONFLICT (escola_id, tipo) DO NOTHING;

  UPDATE public.numero_counters
  SET last_value = GREATEST(public.numero_counters.last_value + 1, p_start),
      updated_at = now()
  WHERE escola_id = p_escola_id AND tipo = p_tipo
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

ALTER FUNCTION public.next_numero_counter(uuid, text, bigint) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.next_numero_counter(uuid, text, bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_matricula_number(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
  v_start bigint := GREATEST(v_floor + 1, 1);
  v_next bigint;
BEGIN
  v_next := public.next_numero_counter(p_escola_id, 'matricula', v_start);
  RETURN v_next;
END;
$$;

ALTER FUNCTION public.next_matricula_number(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.next_numero_processo(p_escola_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := public.next_numero_counter(p_escola_id, 'processo', 1);
  RETURN p_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;

ALTER FUNCTION public.next_numero_processo(uuid, integer) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.generate_unique_numero_login(
  p_escola_id uuid,
  p_role public.user_role,
  p_prefix text,
  p_start integer
)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_max_suffix integer := 0;
  v_next integer;
  v_next_role_start integer;
  role_starts integer[];
  v_counter_key text := 'login:' || p_role::text || ':' || p_prefix;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_login FROM '(\d{4})$') AS INTEGER)), 0)
  INTO v_max_suffix
  FROM profiles
  WHERE escola_id = p_escola_id
    AND role = p_role
    AND numero_login LIKE p_prefix || '%'
    AND SUBSTRING(numero_login FROM '(\d{4})$') ~ '^\d{4}$';

  role_starts := ARRAY[1, 1001, 2001, 3001, 4001];

  SELECT MIN(start_val) INTO v_next_role_start
  FROM unnest(role_starts) AS start_val
  WHERE start_val > p_start;

  v_next := public.next_numero_counter(
    p_escola_id,
    v_counter_key,
    GREATEST(p_start, v_max_suffix + 1)
  );

  IF v_next_role_start IS NOT NULL AND v_next >= v_next_role_start THEN
    RAISE EXCEPTION 'Limite de números para o role % (faixa %-%) atingido',
      p_role, p_start, v_next_role_start - 1;
  END IF;

  RETURN p_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$$;

ALTER FUNCTION public.generate_unique_numero_login(uuid, public.user_role, text, integer) OWNER TO postgres;

COMMIT;
