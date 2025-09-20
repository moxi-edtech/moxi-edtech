-- apps/web/supabase/migrations/20250918_partitioning_and_mviews.sql
-- Declarative partitioning for frequencias and lancamentos (monthly RANGE),
-- with minimal disruption: keep old table as DEFAULT partition. Also adds
-- materialized views for dashboards and optional pg_cron schedule.

-- FREQUENCIAS: partition by RANGE (data)
do $$
declare
  is_partitioned boolean;
begin
  -- Detect if a partitioned table named public.frequencias already exists
  select exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_partitioned_table pt on pt.partrelid = c.oid
    where n.nspname='public' and c.relname='frequencias'
  ) into is_partitioned;

  if not is_partitioned then
    if to_regclass('public.frequencias') is not null then
      -- Rename current table to become the DEFAULT partition
      execute 'alter table public.frequencias rename to frequencias_default';
    end if;

    -- Create partitioned parent
    execute $$
      create table if not exists public.frequencias (
        id uuid primary key,
        matricula_id uuid not null,
        routine_id uuid,
        curso_oferta_id uuid,
        data date not null,
        status text not null,
        escola_id uuid not null
      ) partition by range (data)
    $$;

    -- Recreate RLS policy on parent
    execute 'alter table public.frequencias enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='frequencias' and policyname='tenant_isolation') then
      execute $$create policy tenant_isolation on public.frequencias using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id())$$;
    end if;

    -- Attach old as DEFAULT partition if it exists
    if to_regclass('public.frequencias_default') is not null then
      -- Ensure default has the same columns; add missing with nulls
      perform 1;
      begin
        execute 'alter table public.frequencias_default add column if not exists escola_id uuid';
      exception when duplicate_column then null; end;
      begin
        execute 'alter table public.frequencias_default add column if not exists status text';
      exception when duplicate_column then null; end;
      -- Attach as DEFAULT partition
      execute 'alter table public.frequencias attach partition public.frequencias_default default';
    end if;

    -- Create partitions for current and next month
    perform public.create_month_partition('frequencias', current_date);
    perform public.create_month_partition('frequencias', (current_date + interval '1 month')::date);

    -- Ensure trigger to set escola_id exists on parent
    if not exists (select 1 from pg_trigger where tgname = 'trg_bi_frequencias_escola' and tgrelid = 'public.frequencias'::regclass) then
      execute $$create trigger trg_bi_frequencias_escola before insert or update of matricula_id on public.frequencias
               for each row execute function public.trg_set_escola_frequencias()$$;
    end if;
  end if;
end$$;

-- LANCAMENTOS: partition by RANGE (criado_em)
do $$
declare
  is_partitioned boolean;
begin
  select exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_partitioned_table pt on pt.partrelid = c.oid
    where n.nspname='public' and c.relname='lancamentos'
  ) into is_partitioned;

  if not is_partitioned then
    if to_regclass('public.lancamentos') is not null then
      execute 'alter table public.lancamentos rename to lancamentos_default';
    end if;

    execute $$
      create table if not exists public.lancamentos (
        id uuid primary key,
        avaliacao_id uuid not null,
        matricula_id uuid not null,
        valor numeric not null,
        final boolean not null,
        criado_em timestamptz not null,
        escola_id uuid not null
      ) partition by range (criado_em)
    $$;

    execute 'alter table public.lancamentos enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='lancamentos' and policyname='tenant_isolation') then
      execute $$create policy tenant_isolation on public.lancamentos using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id())$$;
    end if;

    if to_regclass('public.lancamentos_default') is not null then
      begin
        execute 'alter table public.lancamentos_default add column if not exists escola_id uuid';
      exception when duplicate_column then null; end;
      begin
        execute 'alter table public.lancamentos_default add column if not exists criado_em timestamptz';
      exception when duplicate_column then null; end;
      execute 'alter table public.lancamentos attach partition public.lancamentos_default default';
    end if;

    perform public.create_month_partition_ts('lancamentos', date_trunc('month', current_date)::date);
    perform public.create_month_partition_ts('lancamentos', date_trunc('month', (current_date + interval '1 month'))::date);

    if not exists (select 1 from pg_trigger where tgname = 'trg_bi_lancamentos_escola' and tgrelid = 'public.lancamentos'::regclass) then
      execute $$create trigger trg_bi_lancamentos_escola before insert or update of matricula_id on public.lancamentos
               for each row execute function public.trg_set_escola_lancamentos()$$;
    end if;
  end if;
end$$;

-- Helpers to create month partitions (date and timestamptz)
create or replace function public.create_month_partition(tbl text, month_start date)
returns void language plpgsql as $$
declare
  start_d date := date_trunc('month', month_start)::date;
  end_d date := (date_trunc('month', month_start) + interval '1 month')::date;
  part_name text := format('%s_%s', tbl, to_char(start_d, 'YYYY_MM'));
  sql text;
begin
  if to_regclass(format('public.%I', part_name)) is null then
    sql := format('create table public.%I partition of public.%I for values from (%L) to (%L)', part_name, tbl, start_d, end_d);
    execute sql;
    -- indexes aligned to use-cases
    if tbl = 'frequencias' then
      execute format('create index if not exists %I on public.%I (escola_id, routine_id, data)', 'ix_'||part_name||'_escola_routine_data', part_name);
      execute format('create index if not exists %I on public.%I (escola_id, curso_oferta_id, data)', 'ix_'||part_name||'_escola_curso_data', part_name);
    end if;
  end if;
end$$;

create or replace function public.create_month_partition_ts(tbl text, month_start date)
returns void language plpgsql as $$
declare
  start_ts timestamptz := date_trunc('month', month_start)::timestamptz;
  end_ts timestamptz := (date_trunc('month', month_start) + interval '1 month')::timestamptz;
  part_name text := format('%s_%s', tbl, to_char(start_ts, 'YYYY_MM'));
  sql text;
begin
  if to_regclass(format('public.%I', part_name)) is null then
    sql := format('create table public.%I partition of public.%I for values from (%L) to (%L)', part_name, tbl, start_ts, end_ts);
    execute sql;
    if tbl = 'lancamentos' then
      execute format('create index if not exists %I on public.%I (escola_id, avaliacao_id, matricula_id)', 'ix_'||part_name||'_escola_avaliacao_matricula', part_name);
      execute format('create index if not exists %I on public.%I (escola_id, matricula_id)', 'ix_'||part_name||'_escola_matricula', part_name);
    end if;
  end if;
end$$;

-- MATERIALIZED VIEWS (guarded creation)
do $$
begin
  -- mv_financeiro_escola_dia
  if to_regclass('public.pagamentos') is not null and not exists (
    select 1 from pg_matviews where schemaname='public' and matviewname='mv_financeiro_escola_dia'
  ) then
    execute $$create materialized view public.mv_financeiro_escola_dia as
      select escola_id, (created_at::date) as dia,
             count(*) filter (where status = 'pago') as qtd_pagos,
             count(*) as qtd_total
      from public.pagamentos
      group by 1, 2$$;
  end if;

  -- mv_freq_por_turma_dia
  if to_regclass('public.frequencias') is not null and to_regclass('public.matriculas') is not null and not exists (
    select 1 from pg_matviews where schemaname='public' and matviewname='mv_freq_por_turma_dia'
  ) then
    execute $$create materialized view public.mv_freq_por_turma_dia as
      select f.escola_id, m.turma_id, f.data as dia,
             count(*) as total,
             count(*) filter (where f.status = 'presente') as presentes
      from public.frequencias f
      join public.matriculas m on m.id = f.matricula_id
      group by 1,2,3$$;
  end if;

  -- mv_media_por_curso
  if to_regclass('public.lancamentos') is not null and not exists (
    select 1 from pg_matviews where schemaname='public' and matviewname='mv_media_por_curso'
  ) then
    execute $$create materialized view public.mv_media_por_curso as
      select escola_id, curso_oferta_id, avg(valor) as media
      from public.lancamentos l
      join public.avaliacoes a on a.id = l.avaliacao_id
      group by 1,2$$;
  end if;
end$$;

-- REFRESH helpers and optional scheduling via pg_cron
create or replace function public.refresh_all_materialized_views()
returns void language plpgsql as $$
begin
  begin execute 'refresh materialized view public.mv_financeiro_escola_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_freq_por_turma_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_media_por_curso'; exception when undefined_table then null; end;
end$$;

-- Optional: schedule nightly refresh at 03:00 using pg_cron (if available)
do $$
begin
  begin execute 'create extension if not exists pg_cron'; exception when others then null; end;
  if exists (select 1 from pg_extension where extname='pg_cron') then
    -- Create job if absent
    if not exists (select 1 from cron.job where jobname = 'refresh_materialized_views_nightly') then
      perform cron.schedule('refresh_materialized_views_nightly', '0 3 * * *', $$select public.refresh_all_materialized_views()$$);
    end if;
  end if;
end$$;

