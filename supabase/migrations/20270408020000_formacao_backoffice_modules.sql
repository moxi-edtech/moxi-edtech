BEGIN;

-- Catálogo de cursos (Formação)
CREATE TABLE IF NOT EXISTS public.formacao_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  area text,
  modalidade text NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'hibrido')),
  carga_horaria integer CHECK (carga_horaria IS NULL OR carga_horaria > 0),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_cursos_codigo_unique UNIQUE (escola_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_formacao_cursos_escola_status
  ON public.formacao_cursos(escola_id, status);

ALTER TABLE public.formacao_cursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_cursos_select_policy ON public.formacao_cursos;
CREATE POLICY formacao_cursos_select_policy
  ON public.formacao_cursos
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.user_has_role_in_school(escola_id, ARRAY['formando'])
    )
  );

DROP POLICY IF EXISTS formacao_cursos_mutation_policy ON public.formacao_cursos;
CREATE POLICY formacao_cursos_mutation_policy
  ON public.formacao_cursos
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Templates de certificados
CREATE TABLE IF NOT EXISTS public.formacao_certificado_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  diretora_nome text,
  cargo_assinatura text,
  base_legal text,
  regime_default text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_certificado_templates_escola
  ON public.formacao_certificado_templates(escola_id, ativo);

ALTER TABLE public.formacao_certificado_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_certificado_templates_select_policy ON public.formacao_certificado_templates;
CREATE POLICY formacao_certificado_templates_select_policy
  ON public.formacao_certificado_templates
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.user_has_role_in_school(escola_id, ARRAY['formando'])
    )
  );

DROP POLICY IF EXISTS formacao_certificado_templates_mutation_policy ON public.formacao_certificado_templates;
CREATE POLICY formacao_certificado_templates_mutation_policy
  ON public.formacao_certificado_templates
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Certificados emitidos
CREATE TABLE IF NOT EXISTS public.formacao_certificados_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.formacao_certificado_templates(id) ON DELETE SET NULL,
  formando_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cohort_id uuid REFERENCES public.formacao_cohorts(id) ON DELETE SET NULL,
  numero_documento text NOT NULL,
  emitido_em date NOT NULL DEFAULT current_date,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_certificados_emitidos_numero_unique UNIQUE (escola_id, numero_documento)
);

CREATE INDEX IF NOT EXISTS idx_formacao_certificados_emitidos_escola
  ON public.formacao_certificados_emitidos(escola_id, emitido_em DESC);
CREATE INDEX IF NOT EXISTS idx_formacao_certificados_emitidos_formando
  ON public.formacao_certificados_emitidos(escola_id, formando_user_id);

ALTER TABLE public.formacao_certificados_emitidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_certificados_emitidos_select_policy ON public.formacao_certificados_emitidos;
CREATE POLICY formacao_certificados_emitidos_select_policy
  ON public.formacao_certificados_emitidos
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR (
        formando_user_id = auth.uid()
        AND public.user_has_role_in_school(escola_id, ARRAY['formando'])
      )
    )
  );

DROP POLICY IF EXISTS formacao_certificados_emitidos_mutation_policy ON public.formacao_certificados_emitidos;
CREATE POLICY formacao_certificados_emitidos_mutation_policy
  ON public.formacao_certificados_emitidos
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

COMMIT;
