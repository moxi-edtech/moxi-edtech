-- This script is for diagnostic purposes and should be run manually against the remote database.
-- It helps identify data that violates the integrity constraints.

-- Turmas ativas sem curso_id
select id, escola_id, nome, ano_letivo, turma_codigo, status_validacao, curso_id, classe_id
from public.turmas
where status_validacao = 'ativo'
  and curso_id is null;

-- Turmas ativas sem classe_id
select id, escola_id, nome, ano_letivo, turma_codigo, status_validacao, curso_id, classe_id
from public.turmas
where status_validacao = 'ativo'
  and classe_id is null;

-- Matriculas ativas, concluidas ou transferidas sem turma_id
select id, escola_id, aluno_id, status
from public.matriculas
where status IN ('ativo', 'concluido', 'transferido')
  and turma_id is null;
