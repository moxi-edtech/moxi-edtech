CREATE TABLE IF NOT EXISTS public.system_maintenance_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled')),
  maintenance_type text NOT NULL DEFAULT 'infra'
    CHECK (maintenance_type IN ('infra', 'vacuum_full')),
  banner_severity text NOT NULL DEFAULT 'warning'
    CHECK (banner_severity IN ('warning', 'critical')),
  enforce_heavy_ops boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT system_maintenance_windows_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_system_maintenance_windows_status_range
  ON public.system_maintenance_windows(status, starts_at, ends_at);

ALTER TABLE public.system_maintenance_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_maintenance_windows_select ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_select
  ON public.system_maintenance_windows
  FOR SELECT
  TO authenticated
  USING (
    (
      status = 'scheduled'
      AND ends_at > timezone('utc', now())
    )
    OR public.check_super_admin_role()
  );

DROP POLICY IF EXISTS system_maintenance_windows_insert ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_insert
  ON public.system_maintenance_windows
  FOR INSERT
  TO authenticated
  WITH CHECK (public.check_super_admin_role());

DROP POLICY IF EXISTS system_maintenance_windows_update ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_update
  ON public.system_maintenance_windows
  FOR UPDATE
  TO authenticated
  USING (public.check_super_admin_role())
  WITH CHECK (public.check_super_admin_role());

DROP POLICY IF EXISTS system_maintenance_windows_delete ON public.system_maintenance_windows;
CREATE POLICY system_maintenance_windows_delete
  ON public.system_maintenance_windows
  FOR DELETE
  TO authenticated
  USING (public.check_super_admin_role());

GRANT SELECT ON public.system_maintenance_windows TO authenticated;
GRANT ALL ON public.system_maintenance_windows TO service_role;
