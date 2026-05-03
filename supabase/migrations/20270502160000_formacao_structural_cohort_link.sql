-- Migration: Enforce Cohort-Course link and implement materials inheritance
-- Step 1: Create snapshot table for cohort materials
CREATE TABLE IF NOT EXISTS public.formacao_cohort_materiais (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    curso_id uuid REFERENCES public.formacao_cursos(id) ON DELETE SET NULL,
    titulo text NOT NULL,
    url text NOT NULL,
    tipo text NOT NULL DEFAULT 'pdf',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohort_materiais_cohort ON public.formacao_cohort_materiais(cohort_id);

ALTER TABLE public.formacao_cohort_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_cohort_materiais_select_policy ON public.formacao_cohort_materiais;
CREATE POLICY formacao_cohort_materiais_select_policy
  ON public.formacao_cohort_materiais
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
  );

DROP POLICY IF EXISTS formacao_cohort_materiais_mutation_policy ON public.formacao_cohort_materiais;
CREATE POLICY formacao_cohort_materiais_mutation_policy
  ON public.formacao_cohort_materiais
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Step 2: Prevent course deletion if there are linked cohorts
-- We'll change the FK to ON DELETE RESTRICT
ALTER TABLE public.formacao_cohorts 
DROP CONSTRAINT IF EXISTS formacao_cohorts_curso_id_fkey,
ADD CONSTRAINT formacao_cohorts_curso_id_fkey 
    FOREIGN KEY (curso_id) 
    REFERENCES public.formacao_cursos(id) 
    ON DELETE RESTRICT;

-- Note: We are not making curso_id NOT NULL yet to avoid breaking the 2 orphans, 
-- but we will enforce it in the API and UI for new records.
