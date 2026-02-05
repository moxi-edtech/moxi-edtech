CREATE OR REPLACE FUNCTION public.ensure_pagamentos_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF NEW.aluno_id IS NULL AND NEW.mensalidade_id IS NOT NULL THEN
    SELECT m.aluno_id
      INTO NEW.aluno_id
    FROM public.mensalidades m
    WHERE m.id = NEW.mensalidade_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamentos_defaults ON public.pagamentos;
CREATE TRIGGER trg_pagamentos_defaults
BEFORE INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.ensure_pagamentos_defaults();
