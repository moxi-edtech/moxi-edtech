-- 1. Tabela TURMAS
-- Remove a constraint se ela já existir (para evitar o erro que você viu)
ALTER TABLE turmas 
DROP CONSTRAINT IF EXISTS unique_turma_angola;

-- Cria a constraint novamente para garantir que está correta
ALTER TABLE turmas
ADD CONSTRAINT unique_turma_angola
UNIQUE (escola_id, curso_id, classe_id, ano_letivo, nome, turno);


-- 2. Tabela CLASSES (Fazemos o mesmo aqui por segurança)
ALTER TABLE classes 
DROP CONSTRAINT IF EXISTS unique_estrutura_classe;

ALTER TABLE classes
ADD CONSTRAINT unique_estrutura_classe
UNIQUE (escola_id, curso_id, nome);