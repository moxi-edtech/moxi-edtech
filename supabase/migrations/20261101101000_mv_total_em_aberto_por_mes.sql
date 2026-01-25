create materialized view if not exists public.mv_total_em_aberto_por_mes as
select
  escola_id,
  ano_referencia as ano,
  mes_referencia as mes,
  sum(
    greatest(0, coalesce(valor_previsto, valor, 0) - coalesce(valor_pago_total, 0))
  )::numeric(14,2) as total_aberto
from public.mensalidades
where status in ('pendente', 'pago_parcial')
group by escola_id, ano_referencia, mes_referencia;

create unique index if not exists ux_mv_total_em_aberto_por_mes
  on public.mv_total_em_aberto_por_mes (escola_id, ano, mes);

create or replace view public.vw_total_em_aberto_por_mes as
select *
from public.mv_total_em_aberto_por_mes
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_total_em_aberto_por_mes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_total_em_aberto_por_mes;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_total_em_aberto_por_mes') then
      perform cron.schedule(
        'refresh_mv_total_em_aberto_por_mes',
        '*/10 * * * *',
        'select public.refresh_mv_total_em_aberto_por_mes();'
      );
    end if;
  end if;
end $$;
