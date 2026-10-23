-- Additional, non-invasive indexes for larger rosters on the verified,
-- synthetic PostgreSQL benchmark (CC-015). Never apply without release gate.
-- The existing ix_cc_roster_school_turma_year_active is preserved.
CREATE INDEX IF NOT EXISTS ix_cc_active_matricula_per_year_turma
  ON public.matriculas (escola_id, ano_letivo, turma_id, aluno_id)
  WHERE ativo IS TRUE AND status='ativo';

CREATE INDEX IF NOT EXISTS ix_cc_candidates_per_student_year
  ON public.candidaturas (escola_id, aluno_id, ano_letivo, matricula_id);
