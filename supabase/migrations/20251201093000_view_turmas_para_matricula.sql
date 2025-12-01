-- 1. Adicionar a coluna 'curso_id' à tabela 'turmas'
ALTER TABLE turmas 
ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES cursos(id);

-- 2. (Opcional) Indexar para performance
CREATE INDEX IF NOT EXISTS idx_turmas_curso ON turmas(curso_id);

-- 3. Agora podes recriar a View (o script anterior)
DROP VIEW IF EXISTS vw_turmas_para_matricula;

CREATE OR REPLACE VIEW vw_turmas_para_matricula AS
SELECT 
    t.id,
    t.escola_id,
    t.session_id,
    t.nome,
    t.turno,
    t.capacidade_maxima,
    COALESCE(cl.nome, 'Classe não definida') as classe_nome,
    COALESCE(c.nome, 'Ensino Geral') as curso_nome,
    (
        SELECT COUNT(*) 
        FROM matriculas m 
        WHERE m.turma_id = t.id 
        AND m.status IN ('ativa', 'ativo')
    ) as ocupacao_atual
FROM 
    turmas t
    LEFT JOIN classes cl ON t.classe_id = cl.id
    LEFT JOIN cursos c ON t.curso_id = c.id;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;