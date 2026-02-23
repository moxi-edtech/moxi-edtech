BEGIN;

ALTER TABLE public.notas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

DROP TRIGGER IF EXISTS trg_notas_set_updated_at ON public.notas;
CREATE TRIGGER trg_notas_set_updated_at
  BEFORE UPDATE ON public.notas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
