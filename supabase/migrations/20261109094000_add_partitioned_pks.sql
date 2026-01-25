do $$
declare
  r record;
  constraint_name text;
begin
  for r in
    select child.relname as partition_table
    from pg_inherits
    join pg_class parent on pg_inherits.inhparent = parent.oid
    join pg_class child on pg_inherits.inhrelid = child.oid
    join pg_namespace n on n.oid = parent.relnamespace
    where n.nspname = 'public'
      and parent.relname = 'frequencias'
    order by child.relname
  loop
    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', r.partition_table)::regclass
        and contype = 'p'
    ) then
      constraint_name := r.partition_table || '_pkey';
      execute format(
        'alter table public.%I add constraint %I primary key (id, data)',
        r.partition_table,
        constraint_name
      );
    end if;
  end loop;

  for r in
    select child.relname as partition_table
    from pg_inherits
    join pg_class parent on pg_inherits.inhparent = parent.oid
    join pg_class child on pg_inherits.inhrelid = child.oid
    join pg_namespace n on n.oid = parent.relnamespace
    where n.nspname = 'public'
      and parent.relname = 'lancamentos'
    order by child.relname
  loop
    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', r.partition_table)::regclass
        and contype = 'p'
    ) then
      constraint_name := r.partition_table || '_pkey';
      execute format(
        'alter table public.%I add constraint %I primary key (id, criado_em)',
        r.partition_table,
        constraint_name
      );
    end if;
  end loop;
end $$;
