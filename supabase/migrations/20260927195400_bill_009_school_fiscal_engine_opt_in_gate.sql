ALTER TABLE public.fiscal_escola_bindings
  ADD COLUMN IF NOT EXISTS fiscal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiscal_enabled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fiscal_enabled_by uuid NULL;

ALTER TABLE public.fiscal_escola_bindings
  DROP CONSTRAINT IF EXISTS fiscal_escola_bindings_enabled_evidence_chk;

ALTER TABLE public.fiscal_escola_bindings
  ADD CONSTRAINT fiscal_escola_bindings_enabled_evidence_chk
  CHECK (
    (fiscal_enabled = false AND fiscal_enabled_at IS NULL)
    OR
    (fiscal_enabled = true AND fiscal_enabled_at IS NOT NULL)
  );

COMMENT ON COLUMN public.fiscal_escola_bindings.fiscal_enabled IS
  'Gate operacional do motor fiscal por escola. Binding não implica ativação. Default false; pagamentos/financeiro continuam não-fiscais até ativação explícita.';

COMMENT ON COLUMN public.fiscal_escola_bindings.fiscal_enabled_at IS
  'Timestamp da ativação explícita do motor fiscal para a escola.';

COMMENT ON COLUMN public.fiscal_escola_bindings.fiscal_enabled_by IS
  'Actor administrativo que ativou o motor fiscal, quando disponível.';

UPDATE public.fiscal_escola_bindings
SET
  fiscal_enabled = false,
  fiscal_enabled_at = NULL,
  fiscal_enabled_by = NULL
WHERE fiscal_enabled IS DISTINCT FROM false
   OR fiscal_enabled_at IS NOT NULL
   OR fiscal_enabled_by IS NOT NULL;
