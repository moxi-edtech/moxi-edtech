-- Lock search_path for partition helper functions (Supabase Linter 0011)
-- Ensures function name resolution is not role/session dependent.

BEGIN;

create or replace function public.create_month_partition(tbl text, month_start date)
returns void
language plpgsql
set search_path = pg_temp
as $$
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

    -- RLS + Unified policies on the new partition (kept consistent with latest definition)
    execute format('alter table public.%I enable row level security', part_name);
    execute format('alter table public.%I force row level security', part_name);
    if tbl = 'frequencias' then
      execute format('create policy unified_select_frequencias on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_frequencias on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_frequencias on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_frequencias on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;
    if tbl = 'lancamentos' then
      execute format('create policy unified_select_lancamentos on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_lancamentos on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_lancamentos on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_lancamentos on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;

    perform pg_notify('pgrst', 'reload schema');
  end if;
end$$;

create or replace function public.create_month_partition_ts(tbl text, month_start date)
returns void
language plpgsql
set search_path = pg_temp
as $$
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

    -- RLS + Unified policies on the new partition (kept consistent with latest definition)
    execute format('alter table public.%I enable row level security', part_name);
    execute format('alter table public.%I force row level security', part_name);
    if tbl = 'frequencias' then
      execute format('create policy unified_select_frequencias on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_frequencias on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_frequencias on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_frequencias on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;
    if tbl = 'lancamentos' then
      execute format('create policy unified_select_lancamentos on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_lancamentos on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_lancamentos on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_lancamentos on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;

    perform pg_notify('pgrst', 'reload schema');
  end if;
end$$;

COMMIT;

