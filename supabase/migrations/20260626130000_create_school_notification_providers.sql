CREATE TABLE IF NOT EXISTS public.school_notification_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('whatsapp_manual', 'whatsapp_waha')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'pending_qr', 'connected', 'disconnected', 'error')),
  daily_limit integer NOT NULL DEFAULT 0 CHECK (daily_limit >= 0 AND daily_limit <= 500),
  monthly_limit integer NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0 AND monthly_limit <= 5000),
  session_name text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_notification_providers
  ADD COLUMN IF NOT EXISTS session_name text;

ALTER TABLE public.school_notification_providers
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS ux_school_notification_providers_school_type
  ON public.school_notification_providers (school_id, provider_type);

CREATE INDEX IF NOT EXISTS ix_school_notification_providers_school
  ON public.school_notification_providers (school_id);

ALTER TABLE public.school_notification_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_notification_providers_super_admin_all
  ON public.school_notification_providers;

CREATE POLICY school_notification_providers_super_admin_all
  ON public.school_notification_providers
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON public.school_notification_providers FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_notification_providers TO authenticated;
