-- Reconcile vw_matriculas_validas academic year identity with the enrollment SSOT.
-- session_id refers to anos_letivos.id, NOT periodos_letivos.id.
-- Preserve the existing view column order, types, security invoker and read grants.
BEGIN;

CREATE OR REPLACE VIEW public.vw_matriculas_validas
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.escola_id,
  m.aluno_id,
  a.nome AS aluno_nome,
  a.nome_completo,
  a.bi_numero,
  a.numero_processo,
  m.numero_matricula,
  m.numero_chamada,
  m.status,
  m.ano_letivo,
  m.session_id AS ano_letivo_id,
  m.session_id,
  m.data_matricula,
  m.created_at,
  m.turma_id,
  t.nome AS turma_nome,
  t.sala,
  t.turno,
  t.classe_id,
  cl.nome AS classe_nome,
  t.curso_id,
  c.nome AS curso_nome,
  c.tipo AS curso_tipo
FROM public.matriculas m
JOIN public.alunos a ON a.id=m.aluno_id
LEFT JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
LEFT JOIN public.classes cl ON cl.id=t.classe_id AND cl.escola_id=m.escola_id
LEFT JOIN public.cursos c ON c.id=t.curso_id AND c.escola_id=m.escola_id;

DO $check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vw_matriculas_validas v
    WHERE v.ano_letivo_id IS DISTINCT FROM v.session_id
  ) THEN
    RAISE EXCEPTION 'ENROLLMENT_VIEW_YEAR_ID_DIVERGENT';
  END IF;
END
$check$;
COMMIT;
