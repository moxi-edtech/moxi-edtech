BEGIN;

CREATE TABLE IF NOT EXISTS public.school_profile_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.school_operating_profiles(id) ON DELETE RESTRICT,
  action text NOT NULL
    CHECK (action IN ('created', 'updated', 'activated', 'scheduled', 'expired', 'archived')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  before jsonb,
  after jsonb NOT NULL,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_profile_audit_logs_school_created_idx
  ON public.school_profile_audit_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS school_profile_audit_logs_profile_created_idx
  ON public.school_profile_audit_logs (profile_id, created_at DESC);

COMMENT ON TABLE public.school_profile_audit_logs IS
  'Histórico append-only e de retenção própria das alterações de perfil institucional da escola.';

ALTER TABLE public.school_profile_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_profile_audit_logs_select ON public.school_profile_audit_logs;
CREATE POLICY school_profile_audit_logs_select
  ON public.school_profile_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    school_id = public.current_tenant_escola_id()
    OR public.check_super_admin_role()
  );

CREATE OR REPLACE FUNCTION public.prevent_school_profile_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'school_profile_audit_logs is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_school_profile_audit_logs_append_only
  ON public.school_profile_audit_logs;
CREATE TRIGGER trg_school_profile_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.school_profile_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_school_profile_audit_mutation();

CREATE OR REPLACE FUNCTION public.record_school_profile_audit(
  p_school_id uuid,
  p_profile_id uuid,
  p_action text,
  p_reason text,
  p_before jsonb,
  p_after jsonb,
  p_effective_from date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_actor_id uuid := auth.uid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'audit reason is required';
  END IF;

  IF p_after IS NULL THEN
    RAISE EXCEPTION 'audit after snapshot is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.school_operating_profiles p
    WHERE p.id = p_profile_id
      AND p.school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'profile does not belong to school';
  END IF;

  INSERT INTO public.school_profile_audit_logs (
    school_id,
    profile_id,
    action,
    actor_id,
    reason,
    before,
    after,
    effective_from
  )
  VALUES (
    p_school_id,
    p_profile_id,
    p_action,
    v_actor_id,
    btrim(p_reason),
    p_before,
    p_after,
    p_effective_from
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT SELECT ON public.school_profile_audit_logs TO authenticated;
GRANT SELECT ON public.school_profile_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.record_school_profile_audit(
  uuid, uuid, text, text, jsonb, jsonb, date
) TO authenticated, service_role;

COMMIT;
