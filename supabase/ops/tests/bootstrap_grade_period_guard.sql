-- Supplement the existing isolated grade-writer bootstrap with fields used by
-- the modern trimester contract. This is never executed on a live project.
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS data_fim date;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS offering_id uuid;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS source_template_id uuid;
ALTER TABLE public.turma_disciplinas ADD COLUMN IF NOT EXISTS periodos_ativos integer[];

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT public.safe_auth_uid()
$$;

CREATE TABLE IF NOT EXISTS public.test_grade_reopen (
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  avaliacao_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (escola_id,turma_id,avaliacao_id,user_id)
);
CREATE OR REPLACE FUNCTION public.can_bypass_pauta_lock(
  p_escola_id uuid, p_turma_id uuid, p_avaliacao_id uuid, p_user_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_grade_reopen
    WHERE escola_id=p_escola_id AND turma_id=p_turma_id
      AND avaliacao_id=p_avaliacao_id AND user_id=p_user_id
  )
$$;
