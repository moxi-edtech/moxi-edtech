BEGIN;

-- Follow-up de performance do lifecycle de dependências académicas.
-- Cobre FKs apontadas pelo advisor depois de 261240/261250.
-- A tabela está atualmente vazia no live; índices convencionais são suficientes
-- e evitam introduzir complexidade de CREATE INDEX CONCURRENTLY na migration.

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_aluno
  ON public.dependencias_academicas_transicao(aluno_id);

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_disciplina
  ON public.dependencias_academicas_transicao(disciplina_id);

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_exame_sessao
  ON public.dependencias_academicas_transicao(exame_sessao_id)
  WHERE exame_sessao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_turma_disciplina_origem
  ON public.dependencias_academicas_transicao(turma_disciplina_origem_id)
  WHERE turma_disciplina_origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_matricula_origem
  ON public.dependencias_academicas_transicao(matricula_origem_id);

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_eventos_escola
  ON public.dependencias_academicas_transicao_eventos(escola_id, created_at DESC);

COMMIT;
