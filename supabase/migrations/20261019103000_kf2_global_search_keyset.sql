CREATE OR REPLACE FUNCTION public.search_alunos_global_min(
  p_escola_id uuid,
  p_query text,
  p_limit integer DEFAULT 10,
  p_cursor_score double precision DEFAULT NULL,
  p_cursor_updated_at timestamptz DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  label text,
  type text,
  highlight text,
  score double precision,
  updated_at timestamptz,
  created_at timestamptz
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
  v_has_cursor boolean :=
    p_cursor_score IS NOT NULL
    AND p_cursor_updated_at IS NOT NULL
    AND p_cursor_created_at IS NOT NULL
    AND p_cursor_id IS NOT NULL;
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
  WITH base AS (
    SELECT
      a.id,
      coalesce(a.nome_completo, a.nome) AS nome,
      coalesce(a.updated_at, a.created_at) AS updated_at_sort,
      a.created_at,
      GREATEST(
        CASE
          WHEN v_tsquery IS NULL THEN 0
          ELSE ts_rank(to_tsvector('simple', a.search_text), v_tsquery)
        END,
        similarity(coalesce(a.nome_completo, a.nome), v_query),
        similarity(coalesce(a.numero_processo, ''), v_query)
      ) AS score
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
      AND a.deleted_at IS NULL
      AND (
        (v_tsquery IS NOT NULL AND to_tsvector('simple', a.search_text) @@ v_tsquery)
        OR similarity(coalesce(a.nome_completo, a.nome), v_query) > 0.2
        OR similarity(coalesce(a.numero_processo, ''), v_query) > 0.25
      )
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE NOT v_has_cursor
       OR (score, updated_at_sort, created_at, id)
          < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ),
  candidates AS (
    SELECT *
    FROM filtered
    ORDER BY score DESC, updated_at_sort DESC, created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    c.id,
    c.nome AS label,
    'aluno'::text AS type,
    c.nome AS highlight,
    c.score,
    c.updated_at_sort AS updated_at,
    c.created_at
  FROM candidates c
  ORDER BY c.score DESC, c.updated_at_sort DESC, c.created_at DESC, c.id DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_alunos_global_min(uuid, text, integer, double precision, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_alunos_global_min(uuid, text, integer, double precision, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_alunos_global_min(uuid, text, integer, double precision, timestamptz, timestamptz, uuid) TO service_role;
