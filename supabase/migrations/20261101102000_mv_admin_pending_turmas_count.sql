create materialized view if not exists public.mv_admin_pending_turmas_count as
select
  escola_id,
  count(*) filter (where status_validacao <> 'ativo')::int as pendentes_total
from public.turmas
group by escola_id;

create unique index if not exists ux_mv_admin_pending_turmas_count
  on public.mv_admin_pending_turmas_count (escola_id);

create or replace view public.vw_admin_pending_turmas_count as
select *
from public.mv_admin_pending_turmas_count
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_admin_pending_turmas_count()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_admin_pending_turmas_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_admin_pending_turmas_count') then
      perform cron.schedule(
        'refresh_mv_admin_pending_turmas_count',
        '*/10 * * * *',
        'select public.refresh_mv_admin_pending_turmas_count();'
      );
    end if;
  end if;
end $$;
