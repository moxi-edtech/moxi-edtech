BEGIN;

CREATE OR REPLACE VIEW public.vw_turmas_para_matricula AS
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
    t.curso_id AS turma_curso_id,
    t.ano_letivo,
    t.status_validacao,
    COALESCE(co.curso_id, cl.curso_id, t.curso_id) AS curso_id_resolved,
    cl.nome AS classe_nome
  FROM turmas t
  LEFT JOIN classes cl ON t.classe_id = cl.id
  LEFT JOIN cursos_oferta co ON co.turma_id = t.id
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
  b.curso_id_resolved AS curso_id,
  b.ano_letivo,
  (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = b.id AND m.status IN ('ativa','ativo')) AS ocupacao_atual,
  (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = b.id) AS ultima_matricula,
  b.status_validacao -- MOVED TO THE END
FROM base b
LEFT JOIN cursos c ON b.curso_id_resolved = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

COMMIT;
