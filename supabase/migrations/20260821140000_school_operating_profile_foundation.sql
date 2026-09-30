BEGIN;

CREATE TABLE IF NOT EXISTS public.school_operating_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  school_sector text NOT NULL DEFAULT 'private'
    CHECK (school_sector IN ('private', 'public')),
  regulatory_profile text NOT NULL DEFAULT 'angola_private_default',
  finance_model text NOT NULL DEFAULT 'tuition'
    CHECK (finance_model IN ('tuition', 'budget', 'emoluments_only', 'mixed')),
  assessment_policy text NOT NULL DEFAULT 'custom',
  document_profile text NOT NULL DEFAULT 'private_default',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'scheduled', 'active', 'expired', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_operating_profiles_effective_range_check
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_operating_profiles_active_school_uk
  ON public.school_operating_profiles (school_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS school_operating_profiles_school_effective_idx
  ON public.school_operating_profiles (school_id, effective_from DESC);

COMMENT ON TABLE public.school_operating_profiles IS
  'Perfil institucional operacional versionável. V0.1 suporta apenas private/public; defaults preservam o comportamento privado existente.';

INSERT INTO public.school_operating_profiles (
  school_id,
  school_sector,
  regulatory_profile,
  finance_model,
  assessment_policy,
  document_profile,
  effective_from,
  status
)
SELECT
  e.id,
  'private',
  'angola_private_default',
  'tuition',
  'custom',
  'private_default',
  CURRENT_DATE,
  'active'
FROM public.escolas e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.school_operating_profiles p
  WHERE p.school_id = e.id
    AND p.status = 'active'
);

ALTER TABLE public.school_operating_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_operating_profiles_select ON public.school_operating_profiles;
CREATE POLICY school_operating_profiles_select
  ON public.school_operating_profiles
  FOR SELECT
  TO authenticated
  USING (
    school_id = public.current_tenant_escola_id()
    OR public.check_super_admin_role()
  );

DROP POLICY IF EXISTS school_operating_profiles_insert ON public.school_operating_profiles;
CREATE POLICY school_operating_profiles_insert
  ON public.school_operating_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.check_super_admin_role());

DROP POLICY IF EXISTS school_operating_profiles_update ON public.school_operating_profiles;
CREATE POLICY school_operating_profiles_update
  ON public.school_operating_profiles
  FOR UPDATE
  TO authenticated
  USING (public.check_super_admin_role())
  WITH CHECK (public.check_super_admin_role());

DROP POLICY IF EXISTS school_operating_profiles_delete ON public.school_operating_profiles;
CREATE POLICY school_operating_profiles_delete
  ON public.school_operating_profiles
  FOR DELETE
  TO authenticated
  USING (public.check_super_admin_role());

GRANT SELECT ON public.school_operating_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_operating_profiles TO service_role;

COMMIT;
