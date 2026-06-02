CREATE OR REPLACE FUNCTION public.generate_admissao_public_protocol()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'ADM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

ALTER TABLE public.candidaturas
ADD COLUMN IF NOT EXISTS protocolo_publico text;

CREATE OR REPLACE FUNCTION public.set_candidatura_public_protocol()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_protocol text;
BEGIN
  IF NEW.protocolo_publico IS NOT NULL AND btrim(NEW.protocolo_publico) <> '' THEN
    NEW.protocolo_publico := upper(btrim(NEW.protocolo_publico));
    RETURN NEW;
  END IF;

  LOOP
    v_protocol := public.generate_admissao_public_protocol();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.candidaturas c
      WHERE c.escola_id = NEW.escola_id
        AND c.protocolo_publico = v_protocol
    );
  END LOOP;

  NEW.protocolo_publico := v_protocol;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_candidatura_public_protocol ON public.candidaturas;
CREATE TRIGGER trg_set_candidatura_public_protocol
BEFORE INSERT ON public.candidaturas
FOR EACH ROW
EXECUTE FUNCTION public.set_candidatura_public_protocol();

DO $$
DECLARE
  v_row record;
  v_protocol text;
BEGIN
  FOR v_row IN
    SELECT id, escola_id
    FROM public.candidaturas
    WHERE protocolo_publico IS NULL OR btrim(protocolo_publico) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    LOOP
      v_protocol := public.generate_admissao_public_protocol();
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.candidaturas c
        WHERE c.escola_id = v_row.escola_id
          AND c.protocolo_publico = v_protocol
      );
    END LOOP;

    UPDATE public.candidaturas
    SET protocolo_publico = v_protocol
    WHERE id = v_row.id;
  END LOOP;
END $$;

ALTER TABLE public.candidaturas
ALTER COLUMN protocolo_publico SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_escola_protocolo_publico
ON public.candidaturas (escola_id, protocolo_publico);

CREATE INDEX IF NOT EXISTS idx_candidaturas_protocolo_publico
ON public.candidaturas (protocolo_publico);

CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  scope text NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE OR REPLACE FUNCTION public.check_public_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.public_rate_limits%ROWTYPE;
  v_window_start timestamptz;
  v_count integer;
  v_blocked_until timestamptz;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 OR p_block_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid_rate_limit_config';
  END IF;

  INSERT INTO public.public_rate_limits (scope, key, window_start, count, updated_at)
  VALUES (p_scope, p_key, v_now, 0, v_now)
  ON CONFLICT (scope, key) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.public_rate_limits
  WHERE scope = p_scope
    AND key = p_key
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_row.count,
      'limit', p_limit,
      'blocked_until', v_row.blocked_until
    );
  END IF;

  IF v_row.window_start + make_interval(secs => p_window_seconds) <= v_now THEN
    v_window_start := v_now;
    v_count := 1;
  ELSE
    v_window_start := v_row.window_start;
    v_count := v_row.count + 1;
  END IF;

  v_blocked_until := NULL;
  IF v_count > p_limit THEN
    v_blocked_until := v_now + make_interval(secs => p_block_seconds);
  END IF;

  UPDATE public.public_rate_limits
  SET window_start = v_window_start,
      count = v_count,
      blocked_until = v_blocked_until,
      updated_at = v_now
  WHERE scope = p_scope
    AND key = p_key;

  RETURN jsonb_build_object(
    'allowed', v_blocked_until IS NULL,
    'count', v_count,
    'limit', p_limit,
    'blocked_until', v_blocked_until
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_public_rate_limits_updated_at
ON public.public_rate_limits (updated_at);

DROP FUNCTION IF EXISTS public.admissao_public_lookup_by_protocolo(uuid, text);

CREATE FUNCTION public.admissao_public_lookup_by_protocolo(
  p_escola_id uuid,
  p_protocolo text
)
RETURNS TABLE (
  id uuid,
  protocolo_publico text,
  status text,
  aluno_id uuid,
  nome_candidato text,
  responsavel_contato_normalizado text,
  dados_candidato jsonb,
  curso_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.protocolo_publico,
    c.status,
    c.aluno_id,
    c.nome_candidato,
    c.responsavel_contato_normalizado,
    c.dados_candidato,
    cursos.nome AS curso_nome
  FROM public.candidaturas c
  LEFT JOIN public.cursos cursos
    ON cursos.id = c.curso_id
   AND cursos.escola_id = c.escola_id
  WHERE c.escola_id = p_escola_id
    AND c.protocolo_publico = upper(btrim(p_protocolo))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.generate_admissao_public_protocol() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_candidatura_public_protocol() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) TO anon, authenticated, service_role;
