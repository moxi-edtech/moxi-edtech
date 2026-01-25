create materialized view if not exists public.mv_admissoes_counts_por_status as
with counts as (
  select
    escola_id,
    count(*) filter (where status in ('submetida', 'pendente'))::int as submetida_total,
    count(*) filter (where status in ('em_analise'))::int as em_analise_total,
    count(*) filter (where status in ('aprovada', 'aguardando_pagamento'))::int as aprovada_total,
    count(*) filter (where status in ('matriculado', 'convertida')
      and matriculado_em >= now() - interval '7 days')::int as matriculado_7d_total
  from public.candidaturas
  group by escola_id
)
select * from counts;

create unique index if not exists ux_mv_admissoes_counts_por_status
  on public.mv_admissoes_counts_por_status (escola_id);

create or replace view public.vw_admissoes_counts_por_status as
select *
from public.mv_admissoes_counts_por_status
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_admissoes_counts_por_status()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_admissoes_counts_por_status;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_admissoes_counts_por_status') then
      perform cron.schedule(
        'refresh_mv_admissoes_counts_por_status',
        '*/10 * * * *',
        'select public.refresh_mv_admissoes_counts_por_status();'
      );
    end if;
  end if;
end $$;
