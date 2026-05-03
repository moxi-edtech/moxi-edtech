-- Migration: Digital Class Diary (Aulas and Presenças)
-- Date: 02/05/2026

BEGIN;

-- 1. Table for class sessions (Aulas)
CREATE TABLE IF NOT EXISTS public.formacao_aulas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    formador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    data date NOT NULL,
    hora_inicio time,
    hora_fim time,
    conteudo_previsto text,
    conteudo_realizado text,
    horas_ministradas numeric(10,2) DEFAULT 0,
    status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'adiada', 'cancelada')),
    observacoes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_aulas_escola_cohort ON public.formacao_aulas(escola_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_formacao_aulas_data ON public.formacao_aulas(data);

ALTER TABLE public.formacao_aulas ENABLE ROW LEVEL SECURITY;

-- Policies for formacao_aulas
CREATE POLICY formacao_aulas_select_policy
  ON public.formacao_aulas
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id) 
      OR formador_user_id = auth.uid()
    )
  );

CREATE POLICY formacao_aulas_mutation_policy
  ON public.formacao_aulas
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- 2. Table for attendance (Presenças)
CREATE TABLE IF NOT EXISTS public.formacao_presencas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    aula_id uuid NOT NULL REFERENCES public.formacao_aulas(id) ON DELETE CASCADE,
    inscricao_id uuid NOT NULL REFERENCES public.formacao_inscricoes(id) ON DELETE CASCADE,
    presente boolean NOT NULL DEFAULT true,
    justificativa text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT formacao_presencas_aula_inscricao_unique UNIQUE (aula_id, inscricao_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_presencas_aula ON public.formacao_presencas(aula_id);

ALTER TABLE public.formacao_presencas ENABLE ROW LEVEL SECURITY;

-- Policies for formacao_presencas
CREATE POLICY formacao_presencas_select_policy
  ON public.formacao_presencas
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
  );

CREATE POLICY formacao_presencas_mutation_policy
  ON public.formacao_presencas
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR EXISTS (
        SELECT 1 FROM public.formacao_aulas a 
        WHERE a.id = aula_id AND a.formador_user_id = auth.uid()
      )
    )
  );

COMMIT;
