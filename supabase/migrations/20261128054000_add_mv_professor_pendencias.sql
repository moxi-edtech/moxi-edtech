BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_professor_pendencias AS
WITH base AS (
  SELECT
    td.escola_id,
    td.id AS turma_disciplina_id,
    td.turma_id,
    td.professor_id,
    pr.profile_id,
    t.nome AS turma_nome,
    cm.disciplina_id,
    dc.nome AS disciplina_nome
  FROM public.turma_disciplinas td
  LEFT JOIN public.professores pr ON pr.id = td.professor_id
  LEFT JOIN public.turmas t ON t.id = td.turma_id
  LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  LEFT JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
  WHERE td.escola_id IS NOT NULL
),
active_matriculas AS (
  SELECT
    m.escola_id,
    m.turma_id,
    COUNT(*)::int AS total_alunos
  FROM public.matriculas m
  WHERE m.status IN ('ativa', 'ativo', 'active')
  GROUP BY m.escola_id, m.turma_id
),
tipos AS (
  SELECT unnest(ARRAY['MAC','NPP','NPT']) AS tipo
),
trimestres AS (
  SELECT unnest(ARRAY[1,2,3])::int AS trimestre
)
SELECT
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  a.id AS avaliacao_id,
  COALESCE(am.total_alunos, 0) AS total_alunos,
  COUNT(DISTINCT n.matricula_id) FILTER (WHERE n.id IS NOT NULL)::int AS notas_lancadas,
  CASE
    WHEN COALESCE(am.total_alunos, 0) = 0 THEN 0
    WHEN a.id IS NULL THEN COALESCE(am.total_alunos, 0)
    ELSE GREATEST(COALESCE(am.total_alunos, 0) - COUNT(DISTINCT n.matricula_id), 0)
  END AS pendentes
FROM base b
CROSS JOIN tipos t
CROSS JOIN trimestres tr
LEFT JOIN public.avaliacoes a
  ON a.escola_id = b.escola_id
  AND a.turma_disciplina_id = b.turma_disciplina_id
  AND upper(a.tipo) = t.tipo
  AND a.trimestre = tr.trimestre
LEFT JOIN public.notas n
  ON n.escola_id = b.escola_id
  AND n.avaliacao_id = a.id
LEFT JOIN active_matriculas am
  ON am.escola_id = b.escola_id
  AND am.turma_id = b.turma_id
GROUP BY
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  a.id,
  am.total_alunos
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_professor_pendencias
  ON internal.mv_professor_pendencias (escola_id, turma_disciplina_id, tipo, trimestre);

CREATE OR REPLACE VIEW public.vw_professor_pendencias
WITH (security_invoker = true) AS
SELECT
  escola_id,
  professor_id,
  profile_id,
  turma_disciplina_id,
  turma_id,
  turma_nome,
  disciplina_id,
  disciplina_nome,
  tipo,
  trimestre,
  avaliacao_id,
  total_alunos,
  notas_lancadas,
  pendentes
FROM internal.mv_professor_pendencias
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_professor_pendencias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_professor_pendencias',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias$$
);

GRANT ALL ON TABLE internal.mv_professor_pendencias TO anon, authenticated, service_role;

COMMIT;
