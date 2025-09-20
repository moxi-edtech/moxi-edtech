-- apps/web/supabase/migrations/20250918_backfill_partitions.sql
-- Backfills existing data from DEFAULT partitions into monthly partitions
-- for frequencias (by data) and lancamentos (by criado_em).

-- Helper: iterate months between two dates (inclusive start, exclusive end)
create or replace function public._each_month(start_date date, end_date date)
returns table (month_start date, month_end date) language plpgsql as $$
begin
  month_start := date_trunc('month', start_date)::date;
  while month_start < end_date loop
    month_end := (month_start + interval '1 month')::date;
    return next;
    month_start := month_end;
  end loop;
end$$;

-- Backfill FREQUENCIAS
do $$
declare
  min_d date;
  max_d date;
  ms date;
  me date;
begin
  if to_regclass('public.frequencias_default') is not null then
    execute 'select min(data), max(data) from public.frequencias_default' into min_d, max_d;
    if min_d is not null and max_d is not null then
      for ms, me in select * from public._each_month(min_d, (date_trunc('month', max_d) + interval '1 month')::date) loop
        -- ensure partition exists
        perform public.create_month_partition('frequencias', ms);
        -- move rows for this month using delete returning
        execute format($$with moved as (
                   delete from public.frequencias_default
                   where data >= %L and data < %L
                   returning *
                 )
                 insert into public.frequencias select * from moved$$, ms, me);
      end loop;
    end if;
  end if;
end$$;

-- Backfill LANCAMENTOS
do $$
declare
  min_ts timestamptz;
  max_ts timestamptz;
  ms date;
  me date;
begin
  if to_regclass('public.lancamentos_default') is not null then
    execute 'select min(criado_em), max(criado_em) from public.lancamentos_default' into min_ts, max_ts;
    if min_ts is not null and max_ts is not null then
      for ms, me in select * from public._each_month((min_ts)::date, (date_trunc('month', max_ts)::date + interval '1 month')::date) loop
        perform public.create_month_partition_ts('lancamentos', ms);
        execute format($$with moved as (
                   delete from public.lancamentos_default
                   where criado_em >= %L and criado_em < %L
                   returning *
                 )
                 insert into public.lancamentos select * from moved$$, ms::timestamptz, me::timestamptz);
      end loop;
    end if;
  end if;
end$$;

-- Optional: cron to roll partitions monthly (1st day at 00:05)
do $$
begin
  begin execute 'create extension if not exists pg_cron'; exception when others then null; end;
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'ensure_next_month_partitions') then
      perform cron.schedule('ensure_next_month_partitions', '5 0 1 * *', $$
        select public.create_month_partition('frequencias', (current_date + interval '1 month')::date);
        select public.create_month_partition_ts('lancamentos', (date_trunc('month', current_date) + interval '1 month')::date);
      $$);
    end if;
  end if;
end$$;

