begin;

create or replace view public.vw_search_mensalidades as
select
  m.id,
  m.escola_id,
  'mensalidade'::text as type,
  concat_ws(
    ' · ',
    coalesce(a.nome_completo, a.nome, 'Aluno'),
    lpad(coalesce(m.mes_referencia, 0)::text, 2, '0') || '/' || coalesce(m.ano_referencia::text, m.ano_letivo, '')
  ) as label,
  coalesce(m.status, '') as highlight,
  concat_ws(
    ' ',
    coalesce(a.search_text, ''),
    coalesce(m.status, ''),
    coalesce(m.metodo_pagamento, ''),
    coalesce(m.ano_letivo, ''),
    coalesce(m.mes_referencia::text, ''),
    coalesce(m.ano_referencia::text, '')
  ) as search_text,
  coalesce(m.updated_at, m.created_at) as updated_at,
  m.created_at
from public.mensalidades m
left join public.alunos a on a.id = m.aluno_id
where a.deleted_at is null or a.id is null;

create or replace view public.vw_search_pagamentos as
select
  p.id,
  p.escola_id,
  'pagamento'::text as type,
  concat_ws(' · ', coalesce(a.nome_completo, a.nome, 'Pagamento'), coalesce(p.valor_pago::text, '')) as label,
  coalesce(p.status, p.metodo_pagamento, '') as highlight,
  concat_ws(
    ' ',
    coalesce(a.search_text, ''),
    coalesce(p.status, ''),
    coalesce(p.metodo_pagamento, ''),
    coalesce(p.referencia, ''),
    coalesce(p.transacao_id_externo, '')
  ) as search_text,
  coalesce(p.created_at, now()) as updated_at,
  p.created_at
from public.pagamentos p
left join public.mensalidades m on m.id = p.mensalidade_id
left join public.alunos a on a.id = m.aluno_id
where a.deleted_at is null or a.id is null;

create or replace view public.vw_search_recibos as
select
  d.id,
  d.escola_id,
  'recibo'::text as type,
  concat_ws(' · ', 'Recibo', coalesce(a.nome_completo, a.nome, 'Aluno')) as label,
  d.public_id::text as highlight,
  concat_ws(' ', d.public_id::text, coalesce(a.search_text, ''), 'recibo') as search_text,
  d.created_at as updated_at,
  d.created_at
from public.documentos_emitidos d
join public.alunos a on a.id = d.aluno_id
where d.tipo = 'recibo' and d.revoked_at is null;

create or replace function public.search_global_entities(
  p_escola_id uuid,
  p_query text,
  p_types text[] default null,
  p_limit integer default 10,
  p_cursor_score double precision default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table(
  id uuid,
  type text,
  label text,
  highlight text,
  score double precision,
  updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_query text := coalesce(trim(p_query), '');
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

  v_query := replace(v_query, '''', ' ');

  if p_types is not null then
    select array_agg(distinct lower(trim(t)))
      into v_types
      from unnest(p_types) t
     where length(trim(t)) > 0;
  end if;

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
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
    select * from public.vw_search_documentos
    union all
    select * from public.vw_search_mensalidades
    union all
    select * from public.vw_search_pagamentos
    union all
    select * from public.vw_search_recibos
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
          else ts_rank(to_tsvector('simple', coalesce(b.search_text, '')), v_tsquery)
        end,
        similarity(coalesce(b.label, ''), v_query),
        similarity(coalesce(b.highlight, ''), v_query)
      ) as score
    from base b
    where b.escola_id = p_escola_id
      and (v_types is null or b.type = any(v_types))
      and (
        (v_tsquery is not null and to_tsvector('simple', coalesce(b.search_text, '')) @@ v_tsquery)
        or similarity(coalesce(b.label, ''), v_query) > 0.2
        or similarity(coalesce(b.highlight, ''), v_query) > 0.25
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

revoke all on function public.search_global_entities(uuid, text, text[], integer, double precision, timestamptz, timestamptz, uuid) from public;
grant execute on function public.search_global_entities(uuid, text, text[], integer, double precision, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.search_global_entities(uuid, text, text[], integer, double precision, timestamptz, timestamptz, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
