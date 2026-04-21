BEGIN;

-- Comercial do curso (1:1)
CREATE TABLE IF NOT EXISTS public.formacao_curso_comercial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.formacao_cursos(id) ON DELETE CASCADE,
  preco_tabela numeric(14,2) NOT NULL DEFAULT 0 CHECK (preco_tabela >= 0),
  desconto_ativo boolean NOT NULL DEFAULT false,
  desconto_percentual numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
  parceria_b2b_ativa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_curso_comercial_unique UNIQUE (curso_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_curso_comercial_escola
  ON public.formacao_curso_comercial(escola_id, curso_id);

ALTER TABLE public.formacao_curso_comercial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_curso_comercial_select_policy ON public.formacao_curso_comercial;
CREATE POLICY formacao_curso_comercial_select_policy
  ON public.formacao_curso_comercial
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.user_has_role_in_school(escola_id, ARRAY['formando'])
    )
  );

DROP POLICY IF EXISTS formacao_curso_comercial_mutation_policy ON public.formacao_curso_comercial;
CREATE POLICY formacao_curso_comercial_mutation_policy
  ON public.formacao_curso_comercial
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Programa académico (módulos do catálogo)
CREATE TABLE IF NOT EXISTS public.formacao_curso_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.formacao_cursos(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem > 0),
  titulo text NOT NULL,
  carga_horaria integer CHECK (carga_horaria IS NULL OR carga_horaria > 0),
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_curso_modulos_ordem_unique UNIQUE (curso_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_formacao_curso_modulos_escola_curso
  ON public.formacao_curso_modulos(escola_id, curso_id, ordem);

ALTER TABLE public.formacao_curso_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_curso_modulos_select_policy ON public.formacao_curso_modulos;
CREATE POLICY formacao_curso_modulos_select_policy
  ON public.formacao_curso_modulos
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.user_has_role_in_school(escola_id, ARRAY['formando'])
    )
  );

DROP POLICY IF EXISTS formacao_curso_modulos_mutation_policy ON public.formacao_curso_modulos;
CREATE POLICY formacao_curso_modulos_mutation_policy
  ON public.formacao_curso_modulos
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Snapshot de módulos por turma (congelado no momento da criação)
CREATE TABLE IF NOT EXISTS public.formacao_cohort_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.formacao_cursos(id) ON DELETE RESTRICT,
  ordem integer NOT NULL CHECK (ordem > 0),
  titulo text NOT NULL,
  carga_horaria integer CHECK (carga_horaria IS NULL OR carga_horaria > 0),
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_cohort_modulos_ordem_unique UNIQUE (cohort_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohort_modulos_escola_cohort
  ON public.formacao_cohort_modulos(escola_id, cohort_id, ordem);

ALTER TABLE public.formacao_cohort_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_cohort_modulos_select_policy ON public.formacao_cohort_modulos;
CREATE POLICY formacao_cohort_modulos_select_policy
  ON public.formacao_cohort_modulos
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.user_has_role_in_school(escola_id, ARRAY['formando'])
    )
  );

DROP POLICY IF EXISTS formacao_cohort_modulos_mutation_policy ON public.formacao_cohort_modulos;
CREATE POLICY formacao_cohort_modulos_mutation_policy
  ON public.formacao_cohort_modulos
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
