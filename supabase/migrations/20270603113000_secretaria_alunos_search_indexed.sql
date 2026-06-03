CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_search_text(VARIADIC p_parts text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
  SELECT btrim(
    regexp_replace(
      public.immutable_unaccent(lower(coalesce(array_to_string(p_parts, ' '), ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_alunos_secretaria_search_tsv
ON public.alunos
USING gin (
  to_tsvector(
    'simple',
    public.normalize_search_text(
      nome_completo,
      nome,
      responsavel,
      responsavel_nome,
      encarregado_nome,
      email,
      numero_processo,
      bi_numero,
      telefone_responsavel,
      responsavel_contato,
      encarregado_telefone
    )
  )
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_candidaturas_secretaria_search_tsv
ON public.candidaturas
USING gin (
  to_tsvector(
    'simple',
    public.normalize_search_text(
      nome_candidato,
      dados_candidato->>'nome_completo',
      dados_candidato->>'nome',
      dados_candidato->>'email',
      dados_candidato->>'responsavel_nome',
      dados_candidato->>'encarregado_nome',
      dados_candidato->>'numero_processo',
      dados_candidato->>'bi_numero'
    )
  )
);

CREATE OR REPLACE FUNCTION public.secretaria_list_alunos_kf2(
  p_escola_id uuid,
  p_status text DEFAULT 'ativo'::text,
  p_q text DEFAULT NULL::text,
  p_ano_letivo integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  origem text,
  id uuid,
  aluno_id uuid,
  nome text,
  email text,
  responsavel text,
  telefone_responsavel text,
  status text,
  created_at timestamp with time zone,
  numero_processo_login text,
  numero_processo text,
  bi_numero text
)
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
WITH params AS (
  SELECT
    p_escola_id AS escola_id,
    lower(coalesce(p_status, 'ativo')) AS status,
    nullif(trim(coalesce(p_q, '')), '') AS q,
    public.normalize_search_text(p_q) AS q_clean,
    coalesce(p_ano_letivo, extract(year from now())::int) AS ano_letivo,
    greatest(1, least(coalesce(p_limit, 50), 50)) AS lim,
    greatest(coalesce(p_offset, 0), 0) AS off,
    p_cursor_created_at AS cursor_created_at,
    p_cursor_id AS cursor_id
),
query_params AS (
  SELECT
    pr.*,
    CASE
      WHEN pr.q IS NULL OR pr.q_clean = '' THEN NULL::tsquery
      ELSE to_tsquery(
        'simple',
        array_to_string(
          ARRAY(
            SELECT token || ':*'
            FROM unnest(regexp_split_to_array(pr.q_clean, '\s+')) AS token
            WHERE token <> ''
          ),
          ' & '
        )
      )
    END AS q_tsquery
  FROM params pr
),
base_alunos AS (
  SELECT
    'aluno'::text AS origem,
    a.id AS id,
    a.id AS aluno_id,
    a.nome AS nome,
    coalesce(p.email, a.email) AS email,
    coalesce(a.responsavel, a.responsavel_nome, a.encarregado_nome) AS responsavel,
    coalesce(a.telefone_responsavel, a.responsavel_contato, a.encarregado_telefone) AS telefone_responsavel,
    a.status AS status,
    a.created_at AS created_at,
    p.numero_processo_login AS numero_processo_login,
    a.numero_processo AS numero_processo,
    coalesce(a.bi_numero, p.bi_numero) AS bi_numero,
    a.deleted_at AS deleted_at
  FROM public.alunos a
  LEFT JOIN public.profiles p ON p.user_id = a.profile_id
  JOIN query_params pr ON pr.escola_id = a.escola_id
  WHERE pr.q_tsquery IS NULL
     OR to_tsvector(
          'simple',
          public.normalize_search_text(
            a.nome_completo,
            a.nome,
            a.responsavel,
            a.responsavel_nome,
            a.encarregado_nome,
            a.email,
            a.numero_processo,
            a.bi_numero,
            a.telefone_responsavel,
            a.responsavel_contato,
            a.encarregado_telefone
          )
        ) @@ pr.q_tsquery
),
filtered_alunos AS (
  SELECT ba.*
  FROM base_alunos ba
  JOIN query_params pr ON true
  WHERE
    (
      pr.status = 'arquivado' AND ba.deleted_at IS NOT NULL
    )
    OR
    (
      pr.status <> 'arquivado' AND ba.deleted_at IS NULL
    )
),
alunos_status AS (
  SELECT fa.*
  FROM filtered_alunos fa
  JOIN query_params pr ON true
  WHERE
    CASE pr.status
      WHEN 'ativo' THEN EXISTS (
        SELECT 1
        FROM public.matriculas m
        WHERE m.escola_id = pr.escola_id
          AND m.aluno_id = fa.aluno_id
          AND m.ano_letivo = pr.ano_letivo
          AND m.status IN ('ativa', 'ativo', 'active')
      )
      WHEN 'inativo' THEN (fa.status = 'inativo')
      WHEN 'pendente' THEN (fa.status = 'pendente')
      WHEN 'arquivado' THEN true
      ELSE true
    END
),
candidaturas_pendentes AS (
  SELECT
    'candidatura'::text AS origem,
    c.id AS id,
    c.aluno_id AS aluno_id,
    coalesce(c.nome_candidato, (c.dados_candidato->>'nome_completo'), (c.dados_candidato->>'nome')) AS nome,
    (c.dados_candidato->>'email') AS email,
    coalesce((c.dados_candidato->>'responsavel_nome'), (c.dados_candidato->>'encarregado_nome')) AS responsavel,
    coalesce((c.dados_candidato->>'responsavel_contato'), (c.dados_candidato->>'encarregado_telefone')) AS telefone_responsavel,
    c.status AS status,
    c.created_at AS created_at,
    null::text AS numero_processo_login,
    (c.dados_candidato->>'numero_processo') AS numero_processo,
    (c.dados_candidato->>'bi_numero') AS bi_numero
  FROM public.candidaturas c
  JOIN query_params pr ON pr.escola_id = c.escola_id
  WHERE
    pr.status = 'pendente'
    AND c.status IN ('pendente', 'aguardando_pagamento')
    AND c.ano_letivo = pr.ano_letivo
    AND (
      pr.q_tsquery IS NULL
      OR to_tsvector(
          'simple',
          public.normalize_search_text(
            c.nome_candidato,
            c.dados_candidato->>'nome_completo',
            c.dados_candidato->>'nome',
            c.dados_candidato->>'email',
            c.dados_candidato->>'responsavel_nome',
            c.dados_candidato->>'encarregado_nome',
            c.dados_candidato->>'numero_processo',
            c.dados_candidato->>'bi_numero'
          )
        ) @@ pr.q_tsquery
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.escola_id = pr.escola_id
        AND m.aluno_id = c.aluno_id
        AND m.ano_letivo = pr.ano_letivo
        AND m.status IN ('ativa', 'ativo', 'active')
    )
),
unioned AS (
  SELECT origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_processo_login, numero_processo, bi_numero
  FROM alunos_status
  UNION ALL
  SELECT origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_processo_login, numero_processo, bi_numero
  FROM candidaturas_pendentes
)
SELECT u.*
FROM unioned u
JOIN query_params pr ON true
WHERE pr.cursor_created_at IS NULL
   OR (u.created_at, u.id) < (pr.cursor_created_at, pr.cursor_id)
ORDER BY u.created_at DESC, u.id DESC
LIMIT (SELECT lim FROM query_params)
OFFSET (SELECT off FROM query_params);
$$;
