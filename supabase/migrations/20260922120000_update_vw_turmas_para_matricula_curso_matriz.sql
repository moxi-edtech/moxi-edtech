BEGIN;

-- Refaz a view usando curso_matriz/turma_disciplinas em vez de cursos_oferta_legacy
DROP VIEW IF EXISTS public.vw_turmas_para_matricula;

CREATE OR REPLACE VIEW public.vw_turmas_para_matricula AS
WITH base AS (
  SELECT
    t.id,
    t.escola_id,
    COALESCE(t.session_id, al.id) AS session_id,
    t.nome AS turma_nome,
    t.turno,
    t.capacidade_maxima,
    t.sala,
    t.classe_id,
    t.curso_id AS turma_curso_id,
    t.ano_letivo,
    t.status_validacao,
    COALESCE(cm_map.curso_id, cl.curso_id, t.curso_id) AS curso_id_resolved,
    cl.nome AS classe_nome
  FROM public.turmas t
  LEFT JOIN public.classes cl ON t.classe_id = cl.id
  LEFT JOIN LATERAL (
    SELECT DISTINCT ON (td.turma_id) cm.curso_id
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    WHERE td.turma_id = t.id
    ORDER BY td.turma_id, cm.created_at DESC, cm.id DESC
  ) cm_map ON TRUE
  LEFT JOIN public.anos_letivos al ON al.escola_id = t.escola_id AND al.ano = t.ano_letivo
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
  (SELECT COUNT(*) FROM public.matriculas m WHERE m.turma_id = b.id AND m.status IN ('ativa', 'ativo')) AS ocupacao_atual,
  (SELECT MAX(created_at) FROM public.matriculas m WHERE m.turma_id = b.id) AS ultima_matricula,
  b.status_validacao
FROM base b
LEFT JOIN public.cursos c ON b.curso_id_resolved = c.id
LEFT JOIN public.cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

GRANT SELECT ON public.vw_turmas_para_matricula TO anon, authenticated, service_role;

COMMIT;
