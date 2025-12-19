CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_matriculas_escola_aluno_turma_ano_status
ON public.matriculas (escola_id, aluno_id, turma_id, ano_letivo)
WHERE status IN ('ativo','pendente','concluido');