
CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;

  -- ✅ PADRÃO: "ativa"
  IF v IN ('ativa','ativo','active') THEN RETURN 'ativa'; END IF;

  IF v IN ('concluida','concluido','graduado') THEN RETURN 'concluido'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;

CREATE OR REPLACE FUNCTION public.trg_set_matricula_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.status = 'ativa' AND (NEW.numero_matricula IS NULL OR btrim(NEW.numero_matricula) = '') THEN
    v_num := public.next_matricula_number(NEW.escola_id);
    NEW.numero_matricula := v_num::text; -- coluna é text
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.confirmar_matricula(uuid, boolean);

CREATE OR REPLACE FUNCTION public.confirmar_matricula(p_matricula_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero bigint;
  v_escola_id uuid;
BEGIN
  SELECT
    NULLIF(btrim(numero_matricula), '')::bigint,
    escola_id
  INTO v_numero, v_escola_id
  FROM public.matriculas
  WHERE id = p_matricula_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula não encontrada';
  END IF;

  IF v_numero IS NULL THEN
    v_numero := public.next_matricula_number(v_escola_id);
  END IF;

  UPDATE public.matriculas
  SET
    numero_matricula = v_numero::text,
    status = 'ativa',         -- ✅ CASA com o constraint
    ativo = true,
    updated_at = now()
  WHERE id = p_matricula_id;

  RETURN v_numero;
END;
$$;
