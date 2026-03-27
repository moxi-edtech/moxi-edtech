-- Fase 5: SAF-T assíncrono (queue/processing) + bucket privado

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.fiscal_saft_exports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.fiscal_saft_exports DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.fiscal_saft_exports
  ADD CONSTRAINT fiscal_saft_exports_status_check
  CHECK (
    status IN (
      'queued',
      'processing',
      'generated',
      'validated',
      'failed',
      'submitted'
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-saft', 'fiscal-saft', false)
ON CONFLICT (id) DO NOTHING;
