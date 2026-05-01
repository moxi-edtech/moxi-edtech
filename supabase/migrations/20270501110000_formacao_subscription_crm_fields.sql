BEGIN;

ALTER TABLE public.centros_formacao
  ADD COLUMN IF NOT EXISTS last_commercial_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_manual_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_notes text;

COMMENT ON COLUMN public.centros_formacao.last_commercial_contact_at IS 'Último contacto comercial manual ou automático registado pelo Super Admin.';
COMMENT ON COLUMN public.centros_formacao.last_manual_reminder_at IS 'Último lembrete manual enviado pelo Super Admin.';
COMMENT ON COLUMN public.centros_formacao.commercial_notes IS 'Notas comerciais internas do Super Admin sobre subscrição/trial.';

CREATE INDEX IF NOT EXISTS idx_centros_formacao_last_commercial_contact_at
  ON public.centros_formacao(last_commercial_contact_at);

COMMIT;
