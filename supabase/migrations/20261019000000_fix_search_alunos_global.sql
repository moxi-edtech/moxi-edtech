CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_alunos_nome_trgm
  ON public.alunos USING gin ((coalesce(nome_completo, nome)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alunos_processo_trgm
  ON public.alunos USING gin (numero_processo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alunos_bi_trgm
  ON public.alunos USING gin (bi_numero gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_alunos_global(
  p_escola_id uuid,
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  nome text,
  processo text,
  turma text,
  status text,
  aluno_status text,
  turma_id uuid,
  aluno_bi text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := NULL;
  v_tokens text[];
  v_tsquery_text text;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_query = '' OR length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_query := replace(v_query, '''', ' ');

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    ARRAY(
      SELECT regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      FROM unnest(v_tokens) t
      WHERE length(t) > 0
    ),
    ' & '
  );

  IF v_tsquery_text <> '' THEN
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      a.id,
      coalesce(a.nome_completo, a.nome) AS nome,
      a.numero_processo AS processo,
      a.status AS aluno_status,
      a.bi_numero AS aluno_bi,
      a.updated_at,
      a.created_at,
      GREATEST(
        CASE
          WHEN v_tsquery IS NULL THEN 0
          ELSE ts_rank(to_tsvector('simple', a.search_text), v_tsquery)
        END,
        similarity(coalesce(a.nome_completo, a.nome), v_query),
        similarity(coalesce(a.numero_processo, ''), v_query),
        similarity(coalesce(a.bi_numero, ''), v_query)
      ) AS score
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
      AND a.deleted_at IS NULL
      AND (
        (v_tsquery IS NOT NULL AND to_tsvector('simple', a.search_text) @@ v_tsquery)
        OR similarity(coalesce(a.nome_completo, a.nome), v_query) > 0.2
        OR similarity(coalesce(a.numero_processo, ''), v_query) > 0.25
        OR similarity(coalesce(a.bi_numero, ''), v_query) > 0.25
      )
    ORDER BY score DESC, a.updated_at DESC NULLS LAST, a.created_at DESC
    LIMIT v_limit
  )
  SELECT
    c.id,
    c.nome,
    c.processo,
    coalesce(t.nome, 'Sem turma') AS turma,
    coalesce(m.status, 'sem_matricula') AS status,
    c.aluno_status,
    t.id AS turma_id,
    c.aluno_bi
  FROM candidates c
  LEFT JOIN LATERAL (
    SELECT m.turma_id, m.status, m.data_matricula, m.created_at
    FROM public.matriculas m
    WHERE m.aluno_id = c.id
      AND m.escola_id = p_escola_id
    ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC
    LIMIT 1
  ) m ON TRUE
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  ORDER BY c.score DESC, c.updated_at DESC NULLS LAST, c.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_alunos_global(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_alunos_global(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_alunos_global(uuid, text, integer) TO service_role;
