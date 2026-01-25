begin;

create table if not exists public.frequencia_status_periodo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  periodo_letivo_id uuid not null references public.periodos_letivos(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  matricula_id uuid not null references public.matriculas(id) on delete cascade,
  aulas_previstas integer not null default 0,
  presencas integer not null default 0,
  faltas integer not null default 0,
  atrasos integer not null default 0,
  percentual_presenca numeric(5,2) not null default 0,
  frequencia_min_percent integer not null default 75,
  abaixo_minimo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_frequencia_status_periodo
  on public.frequencia_status_periodo (escola_id, turma_id, periodo_letivo_id, aluno_id);

create index if not exists idx_frequencia_status_periodo_lookup
  on public.frequencia_status_periodo (escola_id, turma_id, periodo_letivo_id);

create or replace view public.vw_frequencia_resumo_aluno as
select
  m.escola_id,
  m.turma_id,
  m.aluno_id,
  count(f.id) as total_registros,
  count(*) filter (where f.status = 'presente') as presentes,
  count(*) filter (where f.status = 'falta') as faltas,
  count(*) filter (where f.status = 'atraso') as atrasos,
  case
    when count(f.id) = 0 then 0
    else round((count(*) filter (where f.status = 'presente')::numeric / count(f.id)::numeric) * 100, 2)
  end as percentual_presenca
from public.frequencias f
join public.matriculas m
  on m.id = f.matricula_id
 and m.escola_id = f.escola_id
where m.status in ('ativo','ativa','active')
group by m.escola_id, m.turma_id, m.aluno_id;

create or replace function public.frequencia_resumo_periodo(
  p_turma_id uuid,
  p_periodo_letivo_id uuid
)
returns table (
  escola_id uuid,
  turma_id uuid,
  periodo_letivo_id uuid,
  aluno_id uuid,
  matricula_id uuid,
  aulas_previstas integer,
  presencas integer,
  faltas integer,
  atrasos integer,
  percentual_presenca numeric,
  frequencia_min_percent integer,
  abaixo_minimo boolean
)
language sql
security invoker
set search_path = public
as $$
  with periodo as (
    select id, escola_id, data_inicio, data_fim
    from public.periodos_letivos
    where id = p_periodo_letivo_id
  ),
  config as (
    select escola_id, frequencia_min_percent
    from public.configuracoes_escola
  ),
  matriculas_base as (
    select id, aluno_id, turma_id, escola_id
    from public.matriculas
    where turma_id = p_turma_id
      and status in ('ativo','ativa','active')
  ),
  freq as (
    select f.escola_id, f.matricula_id, f.data, f.status
    from public.frequencias f
    join periodo p on p.escola_id = f.escola_id
    where f.data between p.data_inicio and p.data_fim
  )
  select
    m.escola_id,
    m.turma_id,
    p.id as periodo_letivo_id,
    m.aluno_id,
    m.id as matricula_id,
    count(f.data) as aulas_previstas,
    count(*) filter (where f.status = 'presente') as presencas,
    count(*) filter (where f.status = 'falta') as faltas,
    count(*) filter (where f.status = 'atraso') as atrasos,
    case
      when count(f.data) = 0 then 0
      else round((count(*) filter (where f.status = 'presente')::numeric / count(f.data)::numeric) * 100, 2)
    end as percentual_presenca,
    coalesce(cfg.frequencia_min_percent, 75) as frequencia_min_percent,
    case
      when count(f.data) = 0 then false
      else round((count(*) filter (where f.status = 'presente')::numeric / count(f.data)::numeric) * 100, 2)
        < coalesce(cfg.frequencia_min_percent, 75)
    end as abaixo_minimo
  from matriculas_base m
  join periodo p on p.escola_id = m.escola_id
  left join freq f on f.matricula_id = m.id and f.escola_id = m.escola_id
  left join config cfg on cfg.escola_id = m.escola_id
  group by m.escola_id, m.turma_id, p.id, m.aluno_id, m.id, cfg.frequencia_min_percent;
$$;

create or replace function public.refresh_frequencia_status_periodo(
  p_turma_id uuid,
  p_periodo_letivo_id uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.frequencia_status_periodo (
    escola_id,
    turma_id,
    periodo_letivo_id,
    aluno_id,
    matricula_id,
    aulas_previstas,
    presencas,
    faltas,
    atrasos,
    percentual_presenca,
    frequencia_min_percent,
    abaixo_minimo,
    updated_at
  )
  select
    escola_id,
    turma_id,
    periodo_letivo_id,
    aluno_id,
    matricula_id,
    aulas_previstas,
    presencas,
    faltas,
    atrasos,
    percentual_presenca,
    frequencia_min_percent,
    abaixo_minimo,
    now()
  from public.frequencia_resumo_periodo(p_turma_id, p_periodo_letivo_id)
  on conflict (escola_id, turma_id, periodo_letivo_id, aluno_id)
  do update set
    aulas_previstas = excluded.aulas_previstas,
    presencas = excluded.presencas,
    faltas = excluded.faltas,
    atrasos = excluded.atrasos,
    percentual_presenca = excluded.percentual_presenca,
    frequencia_min_percent = excluded.frequencia_min_percent,
    abaixo_minimo = excluded.abaixo_minimo,
    updated_at = now();
$$;

grant select on public.vw_frequencia_resumo_aluno to authenticated;
grant select on public.frequencia_status_periodo to authenticated;
grant execute on function public.frequencia_resumo_periodo(uuid, uuid) to authenticated;
grant execute on function public.refresh_frequencia_status_periodo(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
