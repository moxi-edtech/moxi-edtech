-- apps/web/supabase/migrations/20250918_partitions_info_fn.sql
-- Helper function to return partition listing for frequencias and lancamentos.

create or replace function public.partitions_info()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb := '[]'::jsonb;
begin
  with part_tables as (
    select c.oid, n.nspname as schema, c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname in ('frequencias','lancamentos')
  ), parts as (
    select pt.name as parent, c.relname as partition
    from part_tables pt
    join pg_inherits i on i.inhparent = pt.oid
    join pg_class c on c.oid = i.inhrelid
  ), agg as (
    select parent, array_agg(partition order by partition) as partitions
    from parts group by parent
  )
  select jsonb_agg(jsonb_build_object('parent', parent, 'partitions', partitions)) into result from agg;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- Grant execute to authenticated (optional, API uses service role anyway)
do $$ begin
  grant execute on function public.partitions_info() to anon, authenticated;
exception when others then null; end $$;

