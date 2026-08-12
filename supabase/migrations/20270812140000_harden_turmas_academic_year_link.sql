BEGIN;

-- Turmas must always belong to the MED academic calendar of the same school.
-- The application already resolves this context; this constraint prevents
-- direct imports or future endpoints from silently dropping the relationship.
CREATE UNIQUE INDEX IF NOT EXISTS ux_anos_letivos_id_escola
  ON public.anos_letivos (id, escola_id);

UPDATE public.turmas t
SET ano_letivo_id = al.id
FROM public.anos_letivos al
WHERE t.ano_letivo_id IS NULL
  AND al.escola_id = t.escola_id
  AND al.ano = t.ano_letivo;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.turmas WHERE ano_letivo_id IS NULL) THEN
    RAISE EXCEPTION 'Existem turmas sem ano_letivo_id; corrija o vínculo antes de aplicar a constraint.';
  END IF;
END $$;

ALTER TABLE public.turmas
  ALTER COLUMN ano_letivo_id SET NOT NULL;

ALTER TABLE public.turmas
  ADD CONSTRAINT turmas_ano_letivo_escola_fkey
  FOREIGN KEY (ano_letivo_id, escola_id)
  REFERENCES public.anos_letivos (id, escola_id);

CREATE OR REPLACE FUNCTION public.sync_turma_academic_year()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer;
  v_ano_letivo_id uuid;
BEGIN
  SELECT al.ano
  INTO v_ano
  FROM public.anos_letivos al
  WHERE al.id = NEW.ano_letivo_id
    AND al.escola_id = NEW.escola_id;

  -- Backwards-compatible imports may still provide the numeric year only.
  -- Resolve it once, then let the NOT NULL/FK constraints enforce the result.
  IF NEW.ano_letivo_id IS NULL THEN
    SELECT al.id, al.ano
    INTO v_ano_letivo_id, v_ano
    FROM public.anos_letivos al
    WHERE al.escola_id = NEW.escola_id
      AND al.ano = NEW.ano_letivo;

    IF v_ano_letivo_id IS NULL THEN
      RAISE EXCEPTION 'Calendário académico MED não encontrado para a escola e ano informados.';
    END IF;
    NEW.ano_letivo_id := v_ano_letivo_id;
  END IF;

  IF v_ano IS NULL THEN
    SELECT al.ano
    INTO v_ano
    FROM public.anos_letivos al
    WHERE al.id = NEW.ano_letivo_id
      AND al.escola_id = NEW.escola_id;
  END IF;

  IF v_ano IS NULL THEN
    RAISE EXCEPTION 'O ano letivo da turma não pertence à escola informada.';
  END IF;

  NEW.ano_letivo := v_ano;
  NEW.session_id := NEW.ano_letivo_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_turma_academic_year ON public.turmas;
CREATE TRIGGER trg_sync_turma_academic_year
BEFORE INSERT OR UPDATE OF escola_id, ano_letivo_id, ano_letivo, session_id
ON public.turmas
FOR EACH ROW
EXECUTE FUNCTION public.sync_turma_academic_year();

COMMIT;
