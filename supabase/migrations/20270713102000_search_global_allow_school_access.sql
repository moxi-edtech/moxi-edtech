BEGIN;

CREATE OR REPLACE FUNCTION "public"."search_global_entities"(
  "p_escola_id" "uuid",
  "p_query" "text",
  "p_types" "text"[] DEFAULT NULL::"text"[],
  "p_limit" integer DEFAULT 10,
  "p_cursor_score" double precision DEFAULT NULL::double precision,
  "p_cursor_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_cursor_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS TABLE(
  "id" "uuid",
  "type" "text",
  "label" "text",
  "highlight" "text",
  "score" double precision,
  "updated_at" timestamp with time zone,
  "created_at" timestamp with time zone
)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_query text := coalesce(trim(p_query), '');
  v_clean_query text;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := null;
  v_tokens text[];
  v_tsquery_text text;
  v_has_cursor boolean :=
    p_cursor_score is not null
    and p_cursor_updated_at is not null
    and p_cursor_created_at is not null
    and p_cursor_id is not null;
  v_types text[] := null;
begin
  if not public.has_access_to_escola_fast(p_escola_id) then
    raise exception 'forbidden';
  end if;

  if v_query = '' or length(v_query) < 2 then
    return;
  end if;

  v_clean_query := public.unaccent(v_query);
  v_clean_query := replace(v_clean_query, '''', ' ');

  if p_types is not null then
    select array_agg(distinct lower(trim(t)))
      into v_types
      from unnest(p_types) t
     where length(trim(t)) > 0;
  end if;

  v_tokens := regexp_split_to_array(regexp_replace(v_clean_query, '\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    array(
      select regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      from unnest(v_tokens) t
      where length(t) > 0
    ),
    ' & '
  );

  if v_tsquery_text <> '' then
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  end if;

  return query
  with base as (
    select * from public.vw_search_alunos
    union all
    select * from public.vw_search_turmas
    union all
    select * from public.vw_search_matriculas
    union all
    select * from public.vw_search_candidaturas
    union all
    select * from public.vw_search_documentos
    union all
    select * from public.vw_search_mensalidades
    union all
    select * from public.vw_search_pagamentos
    union all
    select * from public.vw_search_recibos
    union all
    select * from public.vw_search_professores
    union all
    select * from public.vw_search_cursos
    union all
    select * from public.vw_search_classes
    union all
    select * from public.vw_search_usuarios
  ),
  ranked as (
    select
      b.id,
      b.type,
      b.label,
      b.highlight,
      b.search_text,
      b.updated_at,
      b.created_at,
      greatest(
        case
          when v_tsquery is null then 0
          else ts_rank(to_tsvector('simple', public.unaccent(coalesce(b.search_text, ''))), v_tsquery)
        end,
        similarity(public.unaccent(coalesce(b.label, '')), v_clean_query),
        similarity(public.unaccent(coalesce(b.highlight, '')), v_clean_query)
      ) as score
    from base b
    where b.escola_id = p_escola_id
      and (v_types is null or b.type = any(v_types))
      and (
        (v_tsquery is not null and to_tsvector('simple', public.unaccent(coalesce(b.search_text, ''))) @@ v_tsquery)
        or similarity(public.unaccent(coalesce(b.label, '')), v_clean_query) > 0.15
        or similarity(public.unaccent(coalesce(b.highlight, '')), v_clean_query) > 0.2
      )
  ),
  filtered as (
    select *
    from ranked
    where not v_has_cursor
       or (score, updated_at, created_at, id)
          < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ),
  candidates as (
    select *
    from filtered
    order by score desc, updated_at desc, created_at desc, id desc
    limit v_limit
  )
  select
    c.id,
    c.type,
    c.label,
    c.highlight,
    c.score,
    c.updated_at,
    c.created_at
  from candidates c
  order by c.score desc, c.updated_at desc, c.created_at desc, c.id desc;
end;
$$;

REVOKE ALL ON FUNCTION "public"."search_global_entities"("uuid", "text", "text"[], integer, double precision, timestamp with time zone, timestamp with time zone, "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."search_global_entities"("uuid", "text", "text"[], integer, double precision, timestamp with time zone, timestamp with time zone, "uuid") TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."search_global_entities"("uuid", "text", "text"[], integer, double precision, timestamp with time zone, timestamp with time zone, "uuid") TO service_role;

COMMIT;
