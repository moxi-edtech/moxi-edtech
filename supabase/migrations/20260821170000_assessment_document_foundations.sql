BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  education_level text NOT NULL,
  regulatory_profile text NOT NULL,
  source_reference text,
  source_document_id uuid,
  effective_from date,
  effective_until date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_policy_versions_approved_evidence_check
    CHECK (
      status <> 'approved'
      OR (
        NULLIF(btrim(source_reference), '') IS NOT NULL
        AND source_document_id IS NOT NULL
        AND effective_from IS NOT NULL
        AND NULLIF(btrim(education_level), '') IS NOT NULL
        AND NULLIF(btrim(version), '') IS NOT NULL
      )
    ),
  CONSTRAINT assessment_policy_versions_effective_range_check
    CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from),
  CONSTRAINT assessment_policy_versions_key_version_uk UNIQUE (key, version)
);

CREATE TABLE IF NOT EXISTS public.assessment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL REFERENCES public.assessment_policy_versions(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation_template text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_rules_priority_check CHECK (priority >= 0),
  CONSTRAINT assessment_rules_key_uk UNIQUE (policy_version_id, rule_key)
);

CREATE TABLE IF NOT EXISTS public.assessment_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  academic_year text NOT NULL,
  policy_version_id uuid NOT NULL REFERENCES public.assessment_policy_versions(id) ON DELETE RESTRICT,
  result jsonb NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  override_reason text
);

CREATE INDEX IF NOT EXISTS assessment_policy_versions_profile_status_idx
  ON public.assessment_policy_versions (regulatory_profile, status, effective_from DESC);
CREATE INDEX IF NOT EXISTS assessment_rules_policy_priority_idx
  ON public.assessment_rules (policy_version_id, priority);
CREATE INDEX IF NOT EXISTS assessment_decisions_school_year_idx
  ON public.assessment_decisions (school_id, academic_year, calculated_at DESC);
CREATE INDEX IF NOT EXISTS assessment_decisions_student_idx
  ON public.assessment_decisions (school_id, student_id, academic_year);

CREATE TABLE IF NOT EXISTS public.official_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  regulatory_profile text NOT NULL,
  education_level text,
  format text NOT NULL CHECK (format IN ('pdf', 'xlsx', 'csv')),
  source_reference text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'deprecated')),
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_document_templates_approved_evidence_check
    CHECK (
      status <> 'approved'
      OR (
        NULLIF(btrim(source_reference), '') IS NOT NULL
        AND effective_from IS NOT NULL
      )
    ),
  CONSTRAINT official_document_templates_effective_range_check
    CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);

CREATE TABLE IF NOT EXISTS public.official_document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.official_document_templates(id) ON DELETE CASCADE,
  template_version text NOT NULL,
  source_reference text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'deprecated')),
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_document_template_versions_approved_evidence_check
    CHECK (
      status <> 'approved'
      OR (
        NULLIF(btrim(source_reference), '') IS NOT NULL
        AND effective_from IS NOT NULL
      )
    ),
  CONSTRAINT official_document_template_versions_effective_range_check
    CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from),
  CONSTRAINT official_document_template_versions_key_uk UNIQUE (template_id, template_version)
);

CREATE TABLE IF NOT EXISTS public.official_document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  template_version_id uuid NOT NULL REFERENCES public.official_document_template_versions(id) ON DELETE RESTRICT,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  format text NOT NULL CHECK (format IN ('pdf', 'xlsx', 'csv')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'generated', 'failed', 'cancelled')),
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS official_document_templates_profile_status_idx
  ON public.official_document_templates (regulatory_profile, status, effective_from DESC);
CREATE INDEX IF NOT EXISTS official_document_template_versions_template_idx
  ON public.official_document_template_versions (template_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS official_document_exports_school_created_idx
  ON public.official_document_exports (school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_unapproved_assessment_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.assessment_policy_versions p
    WHERE p.id = NEW.policy_version_id
      AND p.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'assessment policy is not approved for automatic decision';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_decisions_approved_policy
  ON public.assessment_decisions;
CREATE TRIGGER trg_assessment_decisions_approved_policy
  BEFORE INSERT OR UPDATE ON public.assessment_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unapproved_assessment_decision();

ALTER TABLE public.assessment_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_policy_versions_select ON public.assessment_policy_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY assessment_policy_versions_write ON public.assessment_policy_versions
  FOR ALL TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

CREATE POLICY assessment_rules_select ON public.assessment_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY assessment_rules_write ON public.assessment_rules
  FOR ALL TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

CREATE POLICY assessment_decisions_select ON public.assessment_decisions
  FOR SELECT TO authenticated USING (
    school_id = public.current_tenant_escola_id()
    OR public.check_super_admin_role()
  );
CREATE POLICY assessment_decisions_write ON public.assessment_decisions
  FOR ALL TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

CREATE POLICY official_document_templates_select ON public.official_document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY official_document_templates_write ON public.official_document_templates
  FOR ALL TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

CREATE POLICY official_document_template_versions_select ON public.official_document_template_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY official_document_template_versions_write ON public.official_document_template_versions
  FOR ALL TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

CREATE POLICY official_document_exports_select ON public.official_document_exports
  FOR SELECT TO authenticated USING (
    school_id = public.current_tenant_escola_id()
    OR public.check_super_admin_role()
  );
CREATE POLICY official_document_exports_insert ON public.official_document_exports
  FOR INSERT TO authenticated WITH CHECK (
    school_id = public.current_tenant_escola_id()
    OR public.check_super_admin_role()
  );
CREATE POLICY official_document_exports_update ON public.official_document_exports
  FOR UPDATE TO authenticated USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());

GRANT SELECT ON public.assessment_policy_versions, public.assessment_rules TO authenticated;
GRANT SELECT ON public.assessment_decisions TO authenticated;
GRANT SELECT ON public.official_document_templates, public.official_document_template_versions TO authenticated;
GRANT SELECT, INSERT ON public.official_document_exports TO authenticated;
GRANT ALL ON public.assessment_policy_versions, public.assessment_rules,
  public.assessment_decisions, public.official_document_templates,
  public.official_document_template_versions, public.official_document_exports TO service_role;

COMMIT;
