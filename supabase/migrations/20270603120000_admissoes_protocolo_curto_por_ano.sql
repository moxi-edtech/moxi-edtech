CREATE TABLE IF NOT EXISTS public.admissao_protocol_sequences (
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (escola_id, ano_letivo)
);

CREATE OR REPLACE FUNCTION public.generate_admissao_public_protocol(
  p_escola_id uuid,
  p_ano_letivo integer
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer := coalesce(p_ano_letivo, extract(year from now())::integer);
  v_next integer;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'p_escola_id é obrigatório';
  END IF;

  INSERT INTO public.admissao_protocol_sequences (escola_id, ano_letivo, last_value)
  VALUES (p_escola_id, v_ano, 1)
  ON CONFLICT (escola_id, ano_letivo)
  DO UPDATE SET
    last_value = public.admissao_protocol_sequences.last_value + 1,
    updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN right(v_ano::text, 2) || '-' || lpad(v_next::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_admissao_public_protocol()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'ADM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

CREATE OR REPLACE FUNCTION public.set_candidatura_public_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    v_protocol := public.generate_admissao_public_protocol(NEW.escola_id, NEW.ano_letivo);
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

CREATE OR REPLACE FUNCTION public.admissao_public_lookup_by_protocolo(
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

REVOKE ALL ON TABLE public.admissao_protocol_sequences FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.admissao_protocol_sequences TO service_role;

REVOKE ALL ON FUNCTION public.generate_admissao_public_protocol(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_admissao_public_protocol(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_candidatura_public_protocol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_candidatura_public_protocol() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) TO anon, authenticated, service_role;
