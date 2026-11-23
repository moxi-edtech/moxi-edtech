-- Pesquisa global: uma candidatura passa a representar aluno somente depois
-- de existir matrícula válida. Não deduplicar por nome (homónimos são pessoas distintas).
-- As views continuam SECURITY INVOKER; a RPC existente mantém RLS/autorizações/paginação.
BEGIN;

CREATE OR REPLACE VIEW public.vw_search_alunos
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.escola_id,
  'aluno'::text AS type,
  COALESCE(a.nome_completo, a.nome) AS label,
  COALESCE(a.numero_processo, a.bi_numero) AS highlight,
  COALESCE(a.search_text, ''::text) AS search_text,
  COALESCE(a.updated_at, a.created_at) AS updated_at,
  a.created_at
FROM public.alunos AS a
WHERE a.deleted_at IS NULL
  -- A admissão pode criar a identidade em alunos antes da primeira matrícula.
  -- Isso não torna o candidato um aluno pesquisável ainda.
  AND EXISTS (
    SELECT 1
    FROM public.matriculas AS m
    WHERE m.escola_id = a.escola_id
      AND m.aluno_id = a.id
      AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
  );

CREATE OR REPLACE VIEW public.vw_search_candidaturas
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.escola_id,
  'candidatura'::text AS type,
  COALESCE(c.nome_candidato, c.dados_candidato->>'nome_completo', 'Candidato sem nome') AS label,
  CASE
    WHEN c.status = 'matriculado' THEN 'Matrícula pendente de confirmação'
    ELSE COALESCE(c.status, ''::text)
  END AS highlight,
  concat_ws(' '::text, COALESCE(c.nome_candidato, ''::text),
    COALESCE(c.status, ''::text), COALESCE(c.source, ''::text)) AS search_text,
  COALESCE(c.updated_at, c.created_at) AS updated_at,
  c.created_at
FROM public.candidaturas AS c
WHERE
  -- Vinculação explícita à matrícula prevalece mesmo com dados históricos
  -- de ano letivo incoerentes: não regressar uma conversão a candidatura.
  NOT EXISTS (
    SELECT 1
    FROM public.matriculas AS m
    WHERE m.id = c.matricula_id
      AND m.escola_id = c.escola_id
      AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
  )
  -- Admissões antigas podem ter aluno_id sem matricula_id.
  -- Comparar por escola + aluno + ano letivo, nunca apenas pelo nome.
  AND NOT EXISTS (
    SELECT 1
    FROM public.matriculas AS m
    WHERE m.escola_id = c.escola_id
      AND m.aluno_id = c.aluno_id
      AND m.ano_letivo = c.ano_letivo
      AND m.status IN ('ativo', 'ativa', 'concluido', 'transferido')
  );

COMMIT;
