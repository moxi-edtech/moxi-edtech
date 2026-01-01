-- 1. Garantir que a coluna 'tipo' existe na tabela cursos
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'geral'; 
-- Valores esperados: 'geral', 'tecnico', 'puniv', 'primario'

-- 2. Atualizar os dados existentes (Data Patch)
UPDATE cursos SET tipo = 'tecnico' WHERE nome ILIKE '%Técnico%' OR nome ILIKE '%Enfermagem%' OR nome ILIKE '%Farmácia%';
UPDATE cursos SET tipo = 'puniv' WHERE codigo LIKE 'puniv_%' OR nome ILIKE '%Ciências%';
UPDATE cursos SET tipo = 'primario' WHERE codigo = 'primario_base';
UPDATE cursos SET tipo = 'ciclo1' WHERE codigo = 'ciclo1_geral';

-- 3. Atualizar a VIEW para entregar essa coluna ao Frontend
DROP VIEW IF EXISTS vw_turmas_para_matricula;

CREATE OR REPLACE VIEW vw_turmas_para_matricula AS
SELECT 
    t.id, t.escola_id, t.session_id, t.nome, t.turno, t.capacidade_maxima, t.sala,
    COALESCE(cl.nome, 'Classe não definida') as classe_nome,
    COALESCE(c.nome, 'Ensino Geral') as curso_nome,
    c.tipo as curso_tipo, -- <--- AQUI ESTÁ A MÁGICA (A nova coluna)
    (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.status IN ('ativa', 'ativo')) as ocupacao_atual,
    (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = t.id) as ultima_matricula
FROM turmas t
LEFT JOIN classes cl ON t.classe_id = cl.id
LEFT JOIN cursos c ON t.curso_id = c.id;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;
