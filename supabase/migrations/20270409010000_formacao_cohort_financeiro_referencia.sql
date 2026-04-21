BEGIN;

CREATE TABLE IF NOT EXISTS public.formacao_cohort_financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
  moeda text NOT NULL DEFAULT 'AOA',
  valor_referencia numeric(14,2) NOT NULL CHECK (valor_referencia >= 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_cohort_financeiro_unique UNIQUE (escola_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohort_financeiro_escola
  ON public.formacao_cohort_financeiro(escola_id, cohort_id);

ALTER TABLE public.formacao_cohort_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_cohort_financeiro_select_policy ON public.formacao_cohort_financeiro;
CREATE POLICY formacao_cohort_financeiro_select_policy
  ON public.formacao_cohort_financeiro
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

DROP POLICY IF EXISTS formacao_cohort_financeiro_mutation_policy ON public.formacao_cohort_financeiro;
CREATE POLICY formacao_cohort_financeiro_mutation_policy
  ON public.formacao_cohort_financeiro
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
