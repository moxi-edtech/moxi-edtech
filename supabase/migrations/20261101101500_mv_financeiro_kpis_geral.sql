create materialized view if not exists public.mv_financeiro_kpis_geral as
with matriculas as (
  select
    escola_id,
    count(*) filter (where status in ('ativo', 'ativa'))::int as matriculados_total
  from public.matriculas
  group by escola_id
),
mensalidades as (
  select
    escola_id,
    count(*) filter (where status = 'pago')::int as pagos_total,
    sum(case when status = 'pago' then coalesce(valor_previsto, valor, 0) else 0 end)::numeric(14,2) as pagos_valor,
    count(*) filter (where status <> 'pago')::int as pendentes_total,
    sum(case when status <> 'pago' then coalesce(valor_previsto, valor, 0) else 0 end)::numeric(14,2) as pendentes_valor
  from public.mensalidades
  group by escola_id
),
inadimplencia as (
  select
    escola_id,
    count(distinct aluno_id)::int as inadimplentes_total,
    sum(coalesce(valor_previsto, valor, 0))::numeric(14,2) as risco_total
  from public.mensalidades
  where status <> 'pago'
    and data_vencimento < current_date
  group by escola_id
)
select
  e.id as escola_id,
  coalesce(m.matriculados_total, 0) as matriculados_total,
  coalesce(i.inadimplentes_total, 0) as inadimplentes_total,
  coalesce(i.risco_total, 0) as risco_total,
  coalesce(ms.pagos_total, 0) as pagos_total,
  coalesce(ms.pagos_valor, 0) as pagos_valor,
  coalesce(ms.pendentes_total, 0) as pendentes_total,
  coalesce(ms.pendentes_valor, 0) as pendentes_valor
from public.escolas e
left join matriculas m on m.escola_id = e.id
left join mensalidades ms on ms.escola_id = e.id
left join inadimplencia i on i.escola_id = e.id;

create unique index if not exists ux_mv_financeiro_kpis_geral
  on public.mv_financeiro_kpis_geral (escola_id);

create or replace view public.vw_financeiro_kpis_geral as
select *
from public.mv_financeiro_kpis_geral
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_financeiro_kpis_geral()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_financeiro_kpis_geral;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_kpis_geral') then
      perform cron.schedule(
        'refresh_mv_financeiro_kpis_geral',
        '*/10 * * * *',
        'select public.refresh_mv_financeiro_kpis_geral();'
      );
    end if;
  end if;
end $$;
