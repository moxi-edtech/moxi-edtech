-- Migration: Phase 5 - Communication and Certification
-- Date: 05/05/2026

BEGIN;

-- 1. Add recomendado_certificacao to formacao_inscricoes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'formacao_inscricoes' AND column_name = 'recomendado_certificacao') THEN
        ALTER TABLE public.formacao_inscricoes ADD COLUMN recomendado_certificacao boolean DEFAULT false;
    END IF;
END $$;

-- 2. Add relatorio_pedagogico to formacao_cohorts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'formacao_cohorts' AND column_name = 'relatorio_pedagogico') THEN
        ALTER TABLE public.formacao_cohorts ADD COLUMN relatorio_pedagogico text;
    END IF;
END $$;

-- 3. Table for class announcements (avisos)
CREATE TABLE IF NOT EXISTS public.formacao_cohort_avisos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    formador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohort_avisos_cohort ON public.formacao_cohort_avisos(cohort_id);

ALTER TABLE public.formacao_cohort_avisos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for avisos
CREATE POLICY formacao_cohort_avisos_select_policy
  ON public.formacao_cohort_avisos
  FOR SELECT
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY formacao_cohort_avisos_mutation_policy
  ON public.formacao_cohort_avisos
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR EXISTS (
        SELECT 1 FROM public.formacao_cohort_formadores
        WHERE cohort_id = public.formacao_cohort_avisos.cohort_id
          AND formador_user_id = auth.uid()
      )
    )
  );

-- 5. Update RLS for formacao_inscricoes to allow formadores to update recomendado_certificacao
CREATE POLICY formacao_inscricoes_formador_update_policy
ON public.formacao_inscricoes
FOR UPDATE TO public
USING (
  escola_id = public.current_tenant_escola_id()
  AND EXISTS (
    SELECT 1 FROM public.formacao_cohort_formadores
    WHERE cohort_id = public.formacao_inscricoes.cohort_id
      AND formador_user_id = auth.uid()
  )
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
);

-- 6. Update RLS for formacao_cohorts to allow formadores to update relatorio_pedagogico
CREATE POLICY formacao_cohorts_formador_update_policy
ON public.formacao_cohorts
FOR UPDATE TO public
USING (
  escola_id = public.current_tenant_escola_id()
  AND EXISTS (
    SELECT 1 FROM public.formacao_cohort_formadores
    WHERE cohort_id = public.formacao_cohorts.id
      AND formador_user_id = auth.uid()
  )
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
);

COMMIT;
