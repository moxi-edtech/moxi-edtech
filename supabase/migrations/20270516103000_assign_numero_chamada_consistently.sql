BEGIN;

CREATE OR REPLACE FUNCTION public.next_numero_chamada_for_turma(
  p_turma_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  IF p_turma_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('matriculas_numero_chamada:' || p_turma_id::text));

  SELECT COALESCE(MAX(m.numero_chamada), 0) + 1
    INTO v_next
  FROM public.matriculas m
  WHERE m.turma_id = p_turma_id
    AND m.numero_chamada IS NOT NULL;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.renumerar_matriculas_turma(
  p_turma_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_turma_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('matriculas_numero_chamada:' || p_turma_id::text));

  WITH ranked AS (
    SELECT
      m.id,
      ROW_NUMBER() OVER (
        ORDER BY m.created_at ASC NULLS LAST, m.id ASC
      )::integer AS seq
    FROM public.matriculas m
    WHERE m.turma_id = p_turma_id
      AND public.canonicalize_matricula_status_text(m.status) = 'ativo'
  ),
  updated AS (
    UPDATE public.matriculas m
    SET
      numero_chamada = ranked.seq,
      updated_at = now()
    FROM ranked
    WHERE m.id = ranked.id
      AND m.numero_chamada IS DISTINCT FROM ranked.seq
    RETURNING 1
  )
  SELECT COUNT(*)::integer
    INTO v_updated
  FROM updated;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_numero_chamada_matriculas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.turma_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.numero_chamada IS NULL
       AND public.canonicalize_matricula_status_text(NEW.status) = 'ativo' THEN
      NEW.numero_chamada := public.next_numero_chamada_for_turma(NEW.turma_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.turma_id IS DISTINCT FROM OLD.turma_id THEN
    IF NEW.numero_chamada IS NOT DISTINCT FROM OLD.numero_chamada
       AND public.canonicalize_matricula_status_text(NEW.status) = 'ativo' THEN
      NEW.numero_chamada := public.next_numero_chamada_for_turma(NEW.turma_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.numero_chamada IS NULL
     AND public.canonicalize_matricula_status_text(NEW.status) = 'ativo' THEN
    NEW.numero_chamada := public.next_numero_chamada_for_turma(NEW.turma_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_numero_chamada_matriculas ON public.matriculas;

CREATE TRIGGER trg_assign_numero_chamada_matriculas
BEFORE INSERT OR UPDATE OF turma_id, numero_chamada, status
ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.assign_numero_chamada_matriculas();

WITH turmas_ativas AS (
  SELECT DISTINCT m.turma_id
  FROM public.matriculas m
  WHERE m.turma_id IS NOT NULL
    AND public.canonicalize_matricula_status_text(m.status) = 'ativo'
)
SELECT public.renumerar_matriculas_turma(turma_id)
FROM turmas_ativas;

GRANT EXECUTE ON FUNCTION public.next_numero_chamada_for_turma(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renumerar_matriculas_turma(uuid) TO authenticated;

COMMIT;
