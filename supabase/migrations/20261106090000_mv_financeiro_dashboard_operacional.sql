begin;

drop view if exists public.vw_financeiro_kpis_mes;
drop materialized view if exists public.mv_financeiro_kpis_mes;

create materialized view public.mv_financeiro_kpis_mes as
with previsto as (
  select
    m.escola_id,
    date_trunc('month', m.data_vencimento)::date as mes_ref,
    sum(coalesce(m.valor_previsto, m.valor, 0))::numeric(14,2) as previsto_total
  from public.mensalidades m
  where m.status in ('pendente', 'pago', 'atrasado', 'parcial', 'pago_parcial')
  group by m.escola_id, date_trunc('month', m.data_vencimento)::date
),
realizado as (
  select
    p.escola_id,
    date_trunc('month', p.data_pagamento)::date as mes_ref,
    sum(coalesce(p.valor_pago, 0))::numeric(14,2) as realizado_total
  from public.pagamentos p
  where p.data_pagamento is not null
    and p.status in ('pago', 'concluido')
  group by p.escola_id, date_trunc('month', p.data_pagamento)::date
),
inadimplencia as (
  select
    m.escola_id,
    sum(
      greatest(coalesce(m.valor_previsto, m.valor, 0) - coalesce(m.valor_pago_total, 0), 0)
    )::numeric(14,2) as inadimplencia_total
  from public.mensalidades m
  where m.data_vencimento < current_date
    and m.status in ('pendente', 'atrasado', 'parcial', 'pago_parcial')
  group by m.escola_id
),
meses as (
  select distinct escola_id, mes_ref from previsto
  union
  select distinct escola_id, mes_ref from realizado
)
select
  meses.escola_id,
  meses.mes_ref,
  coalesce(previsto.previsto_total, 0) as previsto_total,
  coalesce(realizado.realizado_total, 0) as realizado_total,
  coalesce(inadimplencia.inadimplencia_total, 0) as inadimplencia_total
from meses
left join previsto
  on previsto.escola_id = meses.escola_id
  and previsto.mes_ref = meses.mes_ref
left join realizado
  on realizado.escola_id = meses.escola_id
  and realizado.mes_ref = meses.mes_ref
left join inadimplencia
  on inadimplencia.escola_id = meses.escola_id
with data;

create unique index if not exists ux_mv_financeiro_kpis_mes
  on public.mv_financeiro_kpis_mes (escola_id, mes_ref);

create or replace function public.refresh_mv_financeiro_kpis_mes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_financeiro_kpis_mes;
end;
$$;

create or replace view public.vw_financeiro_kpis_mes as
select *
from public.mv_financeiro_kpis_mes
where escola_id = public.current_tenant_escola_id();

drop view if exists public.vw_financeiro_radar_resumo;
drop materialized view if exists public.mv_financeiro_radar_resumo;

create materialized view public.mv_financeiro_radar_resumo as
with matriculas_ativas as (
  select distinct on (aluno_id)
    aluno_id,
    turma_nome
  from public.vw_matriculas_validas
  order by aluno_id, data_matricula desc nulls last
)
select
  m.escola_id,
  m.aluno_id,
  a.nome as aluno_nome,
  ma.turma_nome,
  array_agg(
    distinct date_trunc('month', m.data_vencimento)::date
    order by date_trunc('month', m.data_vencimento)::date
  ) as meses_atraso,
  sum(
    greatest(coalesce(m.valor_previsto, m.valor, 0) - coalesce(m.valor_pago_total, 0), 0)
  )::numeric(14,2) as valor_total_atraso,
  max(coalesce(a.responsavel_nome, a.responsavel, a.encarregado_nome)) as responsavel_nome,
  max(coalesce(a.telefone_responsavel, a.telefone, a.encarregado_telefone)) as telefone_responsavel
from public.mensalidades m
join public.alunos a on a.id = m.aluno_id
left join matriculas_ativas ma on ma.aluno_id = m.aluno_id
where m.data_vencimento < current_date
  and m.status in ('pendente', 'atrasado', 'parcial', 'pago_parcial')
group by m.escola_id, m.aluno_id, a.nome, ma.turma_nome
with data;

create unique index if not exists ux_mv_financeiro_radar_resumo
  on public.mv_financeiro_radar_resumo (escola_id, aluno_id);

create or replace function public.refresh_mv_financeiro_radar_resumo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_financeiro_radar_resumo;
end;
$$;

create or replace view public.vw_financeiro_radar_resumo as
select *
from public.mv_financeiro_radar_resumo
where escola_id = public.current_tenant_escola_id();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_kpis_mes') then
    perform cron.schedule('refresh_mv_financeiro_kpis_mes', '*/10 * * * *', 'select public.refresh_mv_financeiro_kpis_mes();');
  end if;
  if not exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_radar_resumo') then
    perform cron.schedule('refresh_mv_financeiro_radar_resumo', '*/10 * * * *', 'select public.refresh_mv_financeiro_radar_resumo();');
  end if;
end $$;

commit;
