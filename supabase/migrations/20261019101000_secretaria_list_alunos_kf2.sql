SET LOCAL search_path TO "$user", public, extensions;

create or replace function public.secretaria_list_alunos_kf2(
  p_escola_id uuid,
  p_status text default 'ativo',
  p_q text default null,
  p_ano_letivo int default null,
  p_limit int default 50,
  p_offset int default 0,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  origem text,
  id uuid,
  aluno_id uuid,
  nome text,
  email text,
  responsavel text,
  telefone_responsavel text,
  status text,
  created_at timestamptz,
  numero_login text,
  numero_processo text,
  bi_numero text
)
language sql
stable
as $$
with params as (
  select
    p_escola_id as escola_id,
    lower(coalesce(p_status, 'ativo')) as status,
    nullif(trim(coalesce(p_q, '')), '') as q,
    coalesce(p_ano_letivo, extract(year from now())::int) as ano_letivo,
    greatest(1, least(coalesce(p_limit, 50), 50)) as lim,
    greatest(coalesce(p_offset, 0), 0) as off,
    p_cursor_created_at as cursor_created_at,
    p_cursor_id as cursor_id
),
base_alunos as (
  select
    'aluno'::text as origem,
    a.id as id,
    a.id as aluno_id,
    a.nome as nome,
    coalesce(p.email, a.email) as email,
    coalesce(a.responsavel, a.responsavel_nome, a.encarregado_nome) as responsavel,
    coalesce(a.telefone_responsavel, a.responsavel_contato, a.encarregado_telefone) as telefone_responsavel,
    a.status as status,
    a.created_at as created_at,
    p.numero_login as numero_login,
    a.numero_processo as numero_processo,
    coalesce(a.bi_numero, p.bi_numero) as bi_numero,
    a.deleted_at as deleted_at
  from public.alunos a
  left join public.profiles p on p.user_id = a.profile_id
  join params pr on pr.escola_id = a.escola_id
),
filtered_alunos as (
  select ba.*
  from base_alunos ba
  join params pr on true
  where
    (
      pr.status = 'arquivado' and ba.deleted_at is not null
    )
    or
    (
      pr.status <> 'arquivado' and ba.deleted_at is null
    )
),
alunos_status as (
  select fa.*
  from filtered_alunos fa
  join params pr on true
  where
    case pr.status
      when 'ativo' then exists (
        select 1
        from public.matriculas m
        where m.escola_id = pr.escola_id
          and m.aluno_id = fa.aluno_id
          and m.ano_letivo = pr.ano_letivo
          and m.status in ('ativa', 'ativo', 'active')
      )
      when 'inativo' then (fa.status = 'inativo')
      when 'pendente' then (fa.status = 'pendente')
      when 'arquivado' then true
      else true
    end
),
alunos_search as (
  select s.*
  from alunos_status s
  join params pr on true
  where pr.q is null
     or (
       s.nome ilike ('%' || pr.q || '%')
       or coalesce(s.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_login, '') ilike ('%' || pr.q || '%')
       or coalesce(s.email, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(s.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
candidaturas_pendentes as (
  select
    'candidatura'::text as origem,
    c.id as id,
    c.aluno_id as aluno_id,
    coalesce(c.nome_candidato, (c.dados_candidato->>'nome_completo'), (c.dados_candidato->>'nome')) as nome,
    (c.dados_candidato->>'email') as email,
    coalesce((c.dados_candidato->>'responsavel_nome'), (c.dados_candidato->>'encarregado_nome')) as responsavel,
    coalesce((c.dados_candidato->>'responsavel_contato'), (c.dados_candidato->>'encarregado_telefone')) as telefone_responsavel,
    c.status as status,
    c.created_at as created_at,
    null::text as numero_login,
    (c.dados_candidato->>'numero_processo') as numero_processo,
    (c.dados_candidato->>'bi_numero') as bi_numero
  from public.candidaturas c
  join params pr on pr.escola_id = c.escola_id
  where
    pr.status = 'pendente'
    and c.status in ('pendente', 'aguardando_pagamento')
    and c.ano_letivo = pr.ano_letivo
    and not exists (
      select 1
      from public.matriculas m
      where m.escola_id = pr.escola_id
        and m.aluno_id = c.aluno_id
        and m.ano_letivo = pr.ano_letivo
        and m.status in ('ativa', 'ativo', 'active')
    )
),
candidaturas_search as (
  select cp.*
  from candidaturas_pendentes cp
  join params pr on true
  where pr.q is null
     or (
       cp.nome ilike ('%' || pr.q || '%')
       or coalesce(cp.email, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
unioned as (
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_login, numero_processo, bi_numero
  from alunos_search
  union all
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_login, numero_processo, bi_numero
  from candidaturas_search
)
select u.*
from unioned u
join params pr on true
where pr.cursor_created_at is null
   or (u.created_at, u.id) < (pr.cursor_created_at, pr.cursor_id)
order by u.created_at desc, u.id desc
limit (select lim from params)
offset (select off from params);
$$;

create index if not exists ix_alunos_escola_deleted_status_created
on public.alunos (escola_id, deleted_at, status, created_at desc);

create index if not exists ix_alunos_nome_trgm
on public.alunos using gin (nome gin_trgm_ops);

create index if not exists ix_alunos_numero_processo_trgm
on public.alunos using gin (numero_processo gin_trgm_ops);

create index if not exists ix_alunos_bi_trgm
on public.alunos using gin (bi_numero gin_trgm_ops);

create index if not exists ix_matriculas_lookup_ativo
on public.matriculas (escola_id, ano_letivo, aluno_id, status);

create index if not exists ix_candidaturas_escola_ano_status_created
on public.candidaturas (escola_id, ano_letivo, status, created_at desc);

create index if not exists ix_candidaturas_nome_trgm
on public.candidaturas using gin (nome_candidato gin_trgm_ops);
