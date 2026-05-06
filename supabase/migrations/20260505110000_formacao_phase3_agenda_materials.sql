-- Migration: Evaluation Calendar and Support Materials
-- Date: 05/05/2026

BEGIN;

-- 1. Table for scheduled evaluations
CREATE TABLE IF NOT EXISTS public.formacao_avaliacoes_agenda (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    modulo_id uuid REFERENCES public.formacao_cohort_modulos(id) ON DELETE SET NULL,
    titulo text NOT NULL,
    descricao text,
    data date NOT NULL,
    hora_inicio time,
    hora_fim time,
    local text,
    peso numeric(5,2) DEFAULT 1.0,
    nota_maxima numeric(5,2) DEFAULT 20.0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_avaliacoes_agenda_cohort ON public.formacao_avaliacoes_agenda(cohort_id);
CREATE INDEX IF NOT EXISTS idx_formacao_avaliacoes_agenda_data ON public.formacao_avaliacoes_agenda(data);

ALTER TABLE public.formacao_avaliacoes_agenda ENABLE ROW LEVEL SECURITY;

-- 2. Table for support materials
CREATE TABLE IF NOT EXISTS public.formacao_materiais (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    modulo_id uuid REFERENCES public.formacao_cohort_modulos(id) ON DELETE SET NULL,
    titulo text NOT NULL,
    descricao text,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_materiais_cohort ON public.formacao_materiais(cohort_id);

ALTER TABLE public.formacao_materiais ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY formacao_avaliacoes_agenda_select_policy
  ON public.formacao_avaliacoes_agenda
  FOR SELECT
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY formacao_avaliacoes_agenda_mutation_policy
  ON public.formacao_avaliacoes_agenda
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR EXISTS (
        SELECT 1 FROM public.formacao_cohort_formadores
        WHERE cohort_id = public.formacao_avaliacoes_agenda.cohort_id
          AND formador_user_id = auth.uid()
      )
    )
  );

CREATE POLICY formacao_materiais_select_policy
  ON public.formacao_materiais
  FOR SELECT
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY formacao_materiais_mutation_policy
  ON public.formacao_materiais
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR EXISTS (
        SELECT 1 FROM public.formacao_cohort_formadores
        WHERE cohort_id = public.formacao_materiais.cohort_id
          AND formador_user_id = auth.uid()
      )
    )
  );

COMMIT;
