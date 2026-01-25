create materialized view if not exists public.mv_financeiro_sidebar_badges as
with candidaturas as (
  select
    escola_id,
    count(*)::int as candidaturas_pendentes
  from public.candidaturas
  where status in ('pendente', 'aguardando_compensacao')
  group by escola_id
),
cobrancas as (
  select
    escola_id,
    count(*)::int as cobrancas_pendentes
  from public.financeiro_cobrancas
  where status in ('enviada', 'entregue')
  group by escola_id
)
select
  e.id as escola_id,
  coalesce(candidaturas.candidaturas_pendentes, 0) as candidaturas_pendentes,
  coalesce(cobrancas.cobrancas_pendentes, 0) as cobrancas_pendentes
from public.escolas e
left join candidaturas on candidaturas.escola_id = e.id
left join cobrancas on cobrancas.escola_id = e.id;

create unique index if not exists ux_mv_financeiro_sidebar_badges
  on public.mv_financeiro_sidebar_badges (escola_id);

create or replace view public.vw_financeiro_sidebar_badges as
select *
from public.mv_financeiro_sidebar_badges
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_financeiro_sidebar_badges()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_financeiro_sidebar_badges;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_sidebar_badges') then
      perform cron.schedule(
        'refresh_mv_financeiro_sidebar_badges',
        '*/10 * * * *',
        'select public.refresh_mv_financeiro_sidebar_badges();'
      );
    end if;
  end if;
end $$;
