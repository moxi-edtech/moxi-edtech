create materialized view if not exists public.mv_escola_estrutura_counts as
with cursos_total as (
  select escola_id, count(*)::int as total
  from public.cursos
  group by escola_id
),
classes_total as (
  select escola_id, count(*)::int as total
  from public.classes
  group by escola_id
),
disciplinas_total as (
  select escola_id, count(distinct disciplina_id)::int as total
  from public.curso_matriz
  group by escola_id
)
select
  e.id as escola_id,
  coalesce(cursos_total.total, 0) as cursos_total,
  coalesce(classes_total.total, 0) as classes_total,
  coalesce(disciplinas_total.total, 0) as disciplinas_total
from public.escolas e
left join cursos_total on cursos_total.escola_id = e.id
left join classes_total on classes_total.escola_id = e.id
left join disciplinas_total on disciplinas_total.escola_id = e.id;

create unique index if not exists ux_mv_escola_estrutura_counts
  on public.mv_escola_estrutura_counts (escola_id);

create or replace view public.vw_escola_estrutura_counts as
select *
from public.mv_escola_estrutura_counts
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_escola_estrutura_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_escola_estrutura_counts;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_escola_estrutura_counts') then
      perform cron.schedule(
        'refresh_mv_escola_estrutura_counts',
        '*/10 * * * *',
        'select public.refresh_mv_escola_estrutura_counts();'
      );
    end if;
  end if;
end $$;
