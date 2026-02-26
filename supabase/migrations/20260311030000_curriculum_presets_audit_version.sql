ALTER TABLE public.curriculum_presets
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.curriculum_preset_subjects
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

UPDATE public.curriculum_presets
SET
  version = COALESCE(version, 1),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE version IS NULL OR updated_at IS NULL;

UPDATE public.curriculum_preset_subjects
SET
  version = COALESCE(version, 1),
  updated_at = COALESCE(updated_at, now())
WHERE version IS NULL OR updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.curriculum_presets_audit (
  id bigserial PRIMARY KEY,
  preset_id text,
  subject_id uuid,
  action text NOT NULL,
  actor_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.curriculum_presets_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curriculum_presets_audit_service_full ON public.curriculum_presets_audit;
CREATE POLICY curriculum_presets_audit_service_full
  ON public.curriculum_presets_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS curriculum_presets_audit_admin_read ON public.curriculum_presets_audit;
CREATE POLICY curriculum_presets_audit_admin_read
  ON public.curriculum_presets_audit
  FOR SELECT
  TO authenticated
  USING (public.is_super_or_global_admin());

DROP POLICY IF EXISTS curriculum_presets_audit_admin_write ON public.curriculum_presets_audit;
CREATE POLICY curriculum_presets_audit_admin_write
  ON public.curriculum_presets_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_or_global_admin());

CREATE OR REPLACE FUNCTION public.trg_set_curriculum_presets_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();

  IF TG_OP = 'INSERT' THEN
    NEW.version := COALESCE(NEW.version, 1);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(NEW.version, 1) + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_curriculum_presets_audit_fields ON public.curriculum_presets;
CREATE TRIGGER trg_curriculum_presets_audit_fields
  BEFORE INSERT OR UPDATE ON public.curriculum_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_curriculum_presets_audit_fields();

DROP TRIGGER IF EXISTS trg_curriculum_preset_subjects_audit_fields ON public.curriculum_preset_subjects;
CREATE TRIGGER trg_curriculum_preset_subjects_audit_fields
  BEFORE INSERT OR UPDATE ON public.curriculum_preset_subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_curriculum_presets_audit_fields();
