-- Add unique constraint to turmas to prevent duplicates
ALTER TABLE public.turmas
ADD CONSTRAINT unique_turma_angola
UNIQUE (escola_id, curso_id, classe_id, ano_letivo, nome, turno);

-- Add unique constraint to classes to prevent duplicates
ALTER TABLE public.classes
ADD CONSTRAINT unique_estrutura_classe
UNIQUE (escola_id, curso_id, nome);
