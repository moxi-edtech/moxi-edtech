-- Evolução da Busca Global: Performance e Precisão (Unaccent + Trgm)

-- 1. Extensões e Índices de Performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Índices Trigram para Alunos (mais crítico)
CREATE INDEX IF NOT EXISTS ix_alunos_nome_completo_trgm ON public.alunos USING gin (nome_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_alunos_search_text_trgm ON public.alunos USING gin (search_text gin_trgm_ops);

-- 2. Views Otimizadas (Removendo subqueries redundantes e confiando no RLS)
CREATE OR REPLACE VIEW "public"."vw_search_alunos" WITH ("security_invoker"='true') AS
 SELECT id, escola_id, 'aluno'::text AS type,
    COALESCE(nome_completo, nome) AS label,
    COALESCE(numero_processo, bi_numero) AS highlight,
    COALESCE(search_text, ''::text) AS search_text,
    COALESCE(updated_at, created_at) AS updated_at,
    created_at
   FROM public.alunos a
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW "public"."vw_search_classes" WITH ("security_invoker"='true') AS
 SELECT id, escola_id, 'classe'::text AS type, nome AS label,
    COALESCE((numero)::text, nivel, ''::text) AS highlight,
    concat_ws(' '::text, nome, descricao, nivel, (numero)::text) AS search_text,
    created_at AS updated_at, created_at
   FROM public.classes cl;

CREATE OR REPLACE VIEW "public"."vw_search_cursos" WITH ("security_invoker"='true') AS
 SELECT id, escola_id, 'curso'::text AS type, nome AS label,
    COALESCE(codigo, course_code, ''::text) AS highlight,
    concat_ws(' '::text, nome, codigo, course_code, tipo, nivel) AS search_text,
    COALESCE(updated_at, created_at) AS updated_at, created_at
   FROM public.cursos c;

CREATE OR REPLACE VIEW "public"."vw_search_documentos" WITH ("security_invoker"='true') AS
 SELECT d.id, d.escola_id, 'documento'::text AS type,
    concat_ws(' · '::text, (d.tipo)::text, COALESCE(a.nome_completo, a.nome)) AS label,
    (d.tipo)::text AS highlight,
    concat_ws(' '::text, (d.tipo)::text, COALESCE(a.search_text, ''::text)) AS search_text,
    d.created_at AS updated_at, d.created_at
   FROM (public.documentos_emitidos d
     JOIN public.alunos a ON ((a.id = d.aluno_id)))
  WHERE d.revoked_at IS NULL;

CREATE OR REPLACE VIEW "public"."vw_search_matriculas" WITH ("security_invoker"='true') AS
 SELECT m.id, m.escola_id, 'matricula'::text AS type,
    concat_ws(' · '::text, COALESCE(a.nome_completo, a.nome), t.nome) AS label,
    COALESCE(m.status, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(a.search_text, ''::text), t.nome, COALESCE(m.status, ''::text), COALESCE(m.numero_matricula, ''::text)) AS search_text,
    COALESCE(m.updated_at, m.created_at) AS updated_at, m.created_at
   FROM ((public.matriculas m
     JOIN public.alunos a ON ((a.id = m.aluno_id)))
     JOIN public.turmas t ON ((t.id = m.turma_id)))
  WHERE a.deleted_at IS NULL;

CREATE OR REPLACE VIEW "public"."vw_search_mensalidades" WITH ("security_invoker"='true') AS
 SELECT m.id, m.escola_id, 'mensalidade'::text AS type,
    concat_ws(' · '::text, COALESCE(a.nome_completo, a.nome, 'Aluno'::text), ((lpad((COALESCE((m.mes_referencia)::integer, 0))::text, 2, '0'::text) || '/'::text) || COALESCE((m.ano_referencia)::text, m.ano_letivo, ''::text))) AS label,
    COALESCE(m.status, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(a.search_text, ''::text), COALESCE(m.status, ''::text), COALESCE(m.metodo_pagamento, ''::text), COALESCE(m.ano_letivo, ''::text), COALESCE((m.mes_referencia)::text, ''::text), COALESCE((m.ano_referencia)::text, ''::text)) AS search_text,
    COALESCE(m.updated_at, m.created_at) AS updated_at, m.created_at
   FROM (public.mensalidades m
     LEFT JOIN public.alunos a ON ((a.id = m.aluno_id)))
  WHERE (a.deleted_at IS NULL OR a.id IS NULL);

CREATE OR REPLACE VIEW "public"."vw_search_pagamentos" WITH ("security_invoker"='true') AS
 SELECT p.id, p.escola_id, 'pagamento'::text AS type,
    concat_ws(' · '::text, COALESCE(a.nome_completo, a.nome, 'Pagamento'::text), COALESCE((p.valor_pago)::text, ''::text)) AS label,
    COALESCE(p.status, p.metodo_pagamento, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(a.search_text, ''::text), COALESCE(p.status, ''::text), COALESCE(p.metodo_pagamento, ''::text), COALESCE(p.referencia, ''::text), COALESCE(p.transacao_id_externo, ''::text)) AS search_text,
    COALESCE(p.created_at, now()) AS updated_at, p.created_at
   FROM ((public.pagamentos p
     LEFT JOIN public.mensalidades m ON ((m.id = p.mensalidade_id)))
     LEFT JOIN public.alunos a ON ((a.id = m.aluno_id)))
  WHERE (a.deleted_at IS NULL OR a.id IS NULL);

CREATE OR REPLACE VIEW "public"."vw_search_professores" WITH ("security_invoker"='true') AS
 SELECT p.id, p.escola_id, 'professor'::text AS type,
    COALESCE(pr.nome, p.apelido, 'Professor'::text) AS label,
    COALESCE(pr.email, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(pr.nome, ''::text), COALESCE(p.apelido, ''::text), COALESCE(pr.email, ''::text), COALESCE(pr.numero_login, ''::text)) AS search_text,
    COALESCE(pr.updated_at, p.created_at) AS updated_at,
    COALESCE(pr.created_at, p.created_at) AS created_at
   FROM (public.professores p
     LEFT JOIN public.profiles pr ON ((pr.user_id = p.profile_id)))
  WHERE (pr.deleted_at IS NULL OR pr.user_id IS NULL);

CREATE OR REPLACE VIEW "public"."vw_search_recibos" WITH ("security_invoker"='true') AS
 SELECT d.id, d.escola_id, 'recibo'::text AS type,
    concat_ws(' · '::text, 'Recibo', COALESCE(a.nome_completo, a.nome, 'Aluno'::text)) AS label,
    (d.public_id)::text AS highlight,
    concat_ws(' '::text, (d.public_id)::text, COALESCE(a.search_text, ''::text), 'recibo') AS search_text,
    d.created_at AS updated_at, d.created_at
   FROM (public.documentos_emitidos d
     JOIN public.alunos a ON ((a.id = d.aluno_id)))
  WHERE d.tipo = 'recibo'::public.tipo_documento AND d.revoked_at IS NULL;

CREATE OR REPLACE VIEW "public"."vw_search_turmas" WITH ("security_invoker"='true') AS
 SELECT id, escola_id, 'turma'::text AS type, nome AS label,
    COALESCE(turma_codigo, turma_code, turno) AS highlight,
    concat_ws(' '::text, nome, turma_codigo, turma_code, turno) AS search_text,
    COALESCE(updated_at, created_at) AS updated_at, created_at
   FROM public.turmas t;

CREATE OR REPLACE VIEW "public"."vw_search_usuarios" WITH ("security_invoker"='true') AS
 SELECT eu.id, eu.escola_id, 'usuario'::text AS type,
    COALESCE(pr.nome, pr.email, 'Usuário'::text) AS label,
    COALESCE(eu.papel, eu.role, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(pr.nome, ''::text), COALESCE(pr.email, ''::text), COALESCE(eu.papel, ''::text), COALESCE(eu.role, ''::text), COALESCE(pr.numero_login, ''::text)) AS search_text,
    COALESCE(pr.updated_at, eu.created_at) AS updated_at,
    COALESCE(pr.created_at, eu.created_at) AS created_at
   FROM (public.escola_users eu
     LEFT JOIN public.profiles pr ON ((pr.user_id = eu.user_id)))
  WHERE (pr.deleted_at IS NULL OR pr.user_id IS NULL);

CREATE OR REPLACE VIEW "public"."vw_search_candidaturas" WITH ("security_invoker"='true') AS
 SELECT id, escola_id, 'candidatura'::text AS type,
    COALESCE(nome_candidato, dados_candidato->>'nome_completo', 'Candidato sem nome') AS label,
    COALESCE(status, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(nome_candidato, ''), COALESCE(status, ''), COALESCE(source, '')) AS search_text,
    COALESCE(updated_at, created_at) AS updated_at,
    created_at
   FROM public.candidaturas;

-- 3. RPC de Busca Aprimorada (Unaccented + Performance)
CREATE OR REPLACE FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 10, "p_cursor_score" double precision DEFAULT NULL::double precision, "p_cursor_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "type" "text", "label" "text", "highlight" "text", "score" double precision, "updated_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
  if p_escola_id is distinct from public.current_tenant_escola_id() then
    raise exception 'forbidden';
  end if;

  if v_query = '' or length(v_query) < 2 then
    return;
  end if;

  -- Normalização para busca insensível a acentos
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
  order by c.score desc, c.updated_at desc, c.created_at desc, id desc;
end;
$$;
