-- Alinha o schema de intenções de pagamento com as RPCs do portal e da secretaria.
ALTER TABLE public.pagamento_intents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_pagamento_intents_updated_at
  ON public.pagamento_intents (escola_id, updated_at DESC);

DO $$
BEGIN
  IF to_regprocedure('public.handle_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_pagamento_intents_updated_at ON public.pagamento_intents;
    CREATE TRIGGER trg_pagamento_intents_updated_at
      BEFORE UPDATE ON public.pagamento_intents
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;
