BEGIN;

DROP VIEW IF EXISTS public.vw_matriculas_validas;

CREATE OR REPLACE VIEW public.vw_matriculas_validas AS
SELECT
  m.id                  AS id,
  m.escola_id,
  m.aluno_id,
  a.nome                AS aluno_nome,
  a.nome_completo,
  a.bi_numero,
  a.numero_processo,

  m.numero_matricula,
  m.numero_chamada,
  m.status,
  m.ano_letivo,
  pl.ano_letivo_id,
  m.session_id,
  m.data_matricula,
  m.created_at,

  m.turma_id,
  t.nome                AS turma_nome,
  t.sala,
  t.turno,

  t.classe_id,
  cl.nome               AS classe_nome,

  t.curso_id,
  c.nome                AS curso_nome,
  c.tipo                AS curso_tipo

FROM public.matriculas m
JOIN public.alunos a        ON a.id = m.aluno_id
LEFT JOIN public.turmas t   ON t.id = m.turma_id
LEFT JOIN public.classes cl ON cl.id = t.classe_id
LEFT JOIN public.cursos c   ON c.id = t.curso_id
LEFT JOIN public.periodos_letivos pl ON pl.id = m.session_id;

ALTER VIEW public.vw_matriculas_validas SET (security_invoker = true);
GRANT SELECT ON public.vw_matriculas_validas TO authenticated;

COMMIT;
