-- Student absence justification is an administrative decision, never a financial settlement.
-- Frequency rows are date-partitioned and do not have a globally referencable primary key.
CREATE TABLE IF NOT EXISTS public.aluno_falta_justificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
  frequencia_id uuid NOT NULL,
  data_falta date NOT NULL,
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 15 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_reason text,
  CONSTRAINT falta_justificacao_decision_consistent CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT falta_justificacao_rejection_reason CHECK (
    status <> 'rejected' OR NULLIF(btrim(decision_reason),'') IS NOT NULL
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_falta_justificacao_open_or_approved
  ON public.aluno_falta_justificacoes(escola_id, matricula_id, frequencia_id)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS ix_falta_justificacoes_staff_queue
  ON public.aluno_falta_justificacoes(escola_id, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_falta_justificacoes_aluno
  ON public.aluno_falta_justificacoes(escola_id, matricula_id, created_at DESC);
ALTER TABLE public.aluno_falta_justificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY aluno_falta_justificacoes_read ON public.aluno_falta_justificacoes
  FOR SELECT TO authenticated USING (
    escola_id = public.current_tenant_escola_id()
    AND (public.portal_user_can_access_aluno(aluno_id)
      OR public.user_has_role_in_school(escola_id,
        ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','secretaria_financeiro','admin_financeiro']))
  );
-- Submission is only for a verified guardian or the student if legally adult.
-- Both API and RLS independently check authority, school, enrolment and underlying absence.
CREATE POLICY aluno_falta_justificacoes_submit ON public.aluno_falta_justificacoes
  FOR INSERT TO authenticated WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND submitted_by = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = aluno_falta_justificacoes.matricula_id AND m.aluno_id = aluno_falta_justificacoes.aluno_id AND m.escola_id = aluno_falta_justificacoes.escola_id
        AND m.status IN ('ativo','ativa')
    )
    AND EXISTS (
      SELECT 1 FROM public.frequencias f
      WHERE f.id = aluno_falta_justificacoes.frequencia_id AND f.escola_id = aluno_falta_justificacoes.escola_id
        AND f.matricula_id = aluno_falta_justificacoes.matricula_id AND f.data = aluno_falta_justificacoes.data_falta AND f.status = 'falta'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.alunos a
        WHERE a.id = aluno_falta_justificacoes.aluno_id AND a.escola_id = aluno_falta_justificacoes.escola_id
          AND a.profile_id = (SELECT auth.uid())
          AND a.data_nascimento <= (CURRENT_DATE - INTERVAL '18 years')::date
      )
      OR EXISTS (
        SELECT 1 FROM public.aluno_encarregados ae
        JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = ae.escola_id
        WHERE ae.aluno_id = aluno_falta_justificacoes.aluno_id AND ae.escola_id = aluno_falta_justificacoes.escola_id
          AND lower(btrim(e.email)) = lower(btrim((auth.jwt()->>'email')::text))
      )
    )
  );
CREATE POLICY aluno_falta_justificacoes_staff_decide ON public.aluno_falta_justificacoes
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','secretaria_financeiro','admin_financeiro']))
  WITH CHECK (escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','secretaria_financeiro','admin_financeiro']));

REVOKE ALL ON public.aluno_falta_justificacoes FROM anon, authenticated;
GRANT SELECT ON public.aluno_falta_justificacoes TO authenticated;
GRANT INSERT (escola_id,aluno_id,matricula_id,frequencia_id,data_falta,motivo,submitted_by)
  ON public.aluno_falta_justificacoes TO authenticated;
GRANT UPDATE (status,reviewed_by,reviewed_at,decision_reason)
  ON public.aluno_falta_justificacoes TO authenticated;
COMMENT ON TABLE public.aluno_falta_justificacoes IS
  'Petitions for school review of recorded absences; decisions never erase presence or create payments.';
