-- Migration to add auto_reminders_enabled to super_admin_commercial_settings
BEGIN;

ALTER TABLE public.super_admin_commercial_settings 
ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.super_admin_commercial_settings.auto_reminders_enabled IS 'Enables/disables automated trial reminders via system jobs.';

ALTER TABLE public.centros_formacao
ADD COLUMN IF NOT EXISTS last_automated_reminder_at timestamptz;

COMMENT ON COLUMN public.centros_formacao.last_automated_reminder_at IS 'Last time an automated reminder was sent to this center.';

COMMIT;
