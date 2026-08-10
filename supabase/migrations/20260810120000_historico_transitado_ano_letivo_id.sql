BEGIN;

ALTER TABLE public.historico_transitado_anos
  ADD COLUMN IF NOT EXISTS ano_letivo_id uuid;

UPDATE public.historico_transitado_anos hta
SET ano_letivo_id = al.id
FROM public.anos_letivos al
WHERE hta.ano_letivo_id IS NULL
  AND al.escola_id = hta.escola_id
  AND al.ano = hta.ano_letivo;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos
    WHERE ano_letivo_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Não foi possível associar todo o histórico transitado a uma sessão académica.';
  END IF;
END;
$$;

ALTER TABLE public.historico_transitado_anos
  ALTER COLUMN ano_letivo_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_historico_transitado_anos_ano_letivo'
      AND conrelid = 'public.historico_transitado_anos'::regclass
  ) THEN
    ALTER TABLE public.historico_transitado_anos
      ADD CONSTRAINT fk_historico_transitado_anos_ano_letivo
      FOREIGN KEY (ano_letivo_id) REFERENCES public.anos_letivos(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_historico_transitado_anos_ano_letivo_id
  ON public.historico_transitado_anos (escola_id, aluno_id, classe_id, ano_letivo_id);

CREATE INDEX IF NOT EXISTS idx_historico_transitado_anos_escola_aluno_ano_id
  ON public.historico_transitado_anos (escola_id, aluno_id, ano_letivo_id);

CREATE OR REPLACE FUNCTION public.sync_historico_transitado_ano_letivo_compat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ano integer;
BEGIN
  IF NEW.ano_letivo_id IS NULL AND NEW.ano_letivo IS NOT NULL THEN
    SELECT al.id
    INTO NEW.ano_letivo_id
    FROM public.anos_letivos al
    WHERE al.id IS NOT NULL
      AND al.escola_id = NEW.escola_id
      AND al.ano = NEW.ano_letivo
    ORDER BY al.ativo DESC NULLS LAST, al.data_inicio DESC NULLS LAST, al.id
    LIMIT 1;
  END IF;

  IF NEW.ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: ano letivo académico inválido para esta escola.';
  END IF;

  SELECT al.ano
  INTO v_ano
  FROM public.anos_letivos al
  WHERE al.id = NEW.ano_letivo_id
    AND al.escola_id = NEW.escola_id;

  IF v_ano IS NULL THEN
    RAISE EXCEPTION 'DATA: ano letivo académico inválido para esta escola.';
  END IF;

  NEW.ano_letivo := v_ano;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_historico_transitado_ano_letivo_compat
  ON public.historico_transitado_anos;
CREATE TRIGGER trg_sync_historico_transitado_ano_letivo_compat
BEFORE INSERT OR UPDATE ON public.historico_transitado_anos
FOR EACH ROW
EXECUTE FUNCTION public.sync_historico_transitado_ano_letivo_compat();

COMMIT;
