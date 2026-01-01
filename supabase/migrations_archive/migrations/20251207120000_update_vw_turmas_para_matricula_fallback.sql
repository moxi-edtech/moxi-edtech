-- Atualiza a view de turmas para matrículas com fallback para curso ligado diretamente à turma
-- Corrige cenários onde a classe ainda não está associada a um curso, mas a turma já possui curso_id

DROP VIEW IF EXISTS vw_turmas_para_matricula;

CREATE OR REPLACE VIEW vw_turmas_para_matricula AS
WITH base AS (
    SELECT
        t.id,
        t.escola_id,
        t.session_id,
        t.nome AS turma_nome,
        t.turno,
        t.capacidade_maxima,
        t.sala,
        t.classe_id,
        COALESCE(cl.curso_id, t.curso_id) AS curso_id_fallback,
        cl.nome AS classe_nome
    FROM turmas t
    LEFT JOIN classes cl ON t.classe_id = cl.id
)
SELECT
    b.id,
    b.escola_id,
    b.session_id,
    b.turma_nome,
    b.turno,
    b.capacidade_maxima,
    b.sala,
    COALESCE(b.classe_nome, 'Classe não definida') AS classe_nome,
    COALESCE(c.nome, 'Ensino Geral') AS curso_nome,
    COALESCE(c.tipo, 'geral') AS curso_tipo,
    COALESCE(c.is_custom, false) AS curso_is_custom,
    cgc.hash AS curso_global_hash,
    b.classe_id,
    b.curso_id_fallback AS curso_id,
    (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = b.id AND m.status IN ('ativa','ativo')) AS ocupacao_atual,
    (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = b.id) AS ultima_matricula
FROM base b
LEFT JOIN cursos c ON b.curso_id_fallback = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;
