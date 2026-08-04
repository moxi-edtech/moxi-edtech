BEGIN;

CREATE TABLE IF NOT EXISTS public.school_workflow_configs (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.anos_letivos(id) ON DELETE SET NULL,
  grade_workflow jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_workflow_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_workflow_configs_select ON public.school_workflow_configs;
CREATE POLICY school_workflow_configs_select
  ON public.school_workflow_configs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = school_workflow_configs.escola_id
      AND eu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS school_workflow_configs_manage ON public.school_workflow_configs;
CREATE POLICY school_workflow_configs_manage
  ON public.school_workflow_configs FOR ALL TO authenticated
  USING (public.user_has_role_in_school(
    school_workflow_configs.escola_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'admin_secretaria']
  ))
  WITH CHECK (public.user_has_role_in_school(
    school_workflow_configs.escola_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'admin_secretaria']
  ));

GRANT SELECT, INSERT, UPDATE ON public.school_workflow_configs TO authenticated;

DROP TRIGGER IF EXISTS trg_school_workflow_configs_updated_at ON public.school_workflow_configs;
CREATE TRIGGER trg_school_workflow_configs_updated_at
  BEFORE UPDATE ON public.school_workflow_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.school_workflow_configs IS
  'Configuração canônica dos fluxos operacionais da escola, vinculada ao ano letivo.';

COMMIT;
