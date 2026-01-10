-- Indexes to speed up migration lookups (non-destructive)

CREATE INDEX IF NOT EXISTS idx_staging_alunos_import_turma
  ON public.staging_alunos (escola_id, import_id, turma_codigo, ano_letivo);

CREATE INDEX IF NOT EXISTS idx_turmas_escola_turma_code
  ON public.turmas (escola_id, turma_code, ano_letivo);

CREATE INDEX IF NOT EXISTS idx_cursos_escola_codigo
  ON public.cursos (escola_id, codigo);

CREATE INDEX IF NOT EXISTS idx_cursos_escola_course_code
  ON public.cursos (escola_id, course_code);
