create materialized view if not exists public.mv_financeiro_cobrancas_diario as
select
  c.escola_id,
  c.enviado_em::date as dia,
  count(*) filter (where c.status = 'enviada')::int as enviadas,
  count(*) filter (where c.status = 'respondida')::int as respondidas,
  count(*) filter (where c.status = 'paga')::int as pagos,
  sum(
    case when c.status = 'paga'
      then coalesce(m.valor_previsto, m.valor, 0)
      else 0
    end
  )::numeric(14,2) as valor_recuperado
from public.financeiro_cobrancas c
left join public.mensalidades m on m.id = c.mensalidade_id
group by c.escola_id, c.enviado_em::date;

create unique index if not exists ux_mv_financeiro_cobrancas_diario
  on public.mv_financeiro_cobrancas_diario (escola_id, dia);

create or replace view public.vw_financeiro_cobrancas_diario as
select *
from public.mv_financeiro_cobrancas_diario
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_financeiro_cobrancas_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_financeiro_cobrancas_diario;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_cobrancas_diario') then
      perform cron.schedule(
        'refresh_mv_financeiro_cobrancas_diario',
        '*/10 * * * *',
        'select public.refresh_mv_financeiro_cobrancas_diario();'
      );
    end if;
  end if;
end $$;
