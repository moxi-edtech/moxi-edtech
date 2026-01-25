do $$
declare
  r record;
  idx_name text;
  cols text;
begin
  for r in
    with fkeys as (
      select
        con.oid as constraint_oid,
        n.nspname as schema_name,
        c.relname as table_name,
        con.conkey
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where con.contype = 'f'
        and n.nspname = 'public'
    ), fkey_cols as (
      select
        fkeys.constraint_oid,
        fkeys.schema_name,
        fkeys.table_name,
        array_agg(att.attname order by ord.ordinality) as column_names,
        array_agg(att.attnum order by ord.ordinality)::int2[] as attnums
      from fkeys
      join unnest(fkeys.conkey) with ordinality as ord(attnum, ordinality)
        on true
      join pg_attribute att
        on att.attrelid = (fkeys.schema_name || '.' || fkeys.table_name)::regclass
       and att.attnum = ord.attnum
      group by fkeys.constraint_oid, fkeys.schema_name, fkeys.table_name
    ), missing_indexes as (
      select
        fkey_cols.schema_name,
        fkey_cols.table_name,
        fkey_cols.column_names,
        fkey_cols.attnums
      from fkey_cols
      where not exists (
        select 1
        from pg_index idx
        where idx.indrelid = (fkey_cols.schema_name || '.' || fkey_cols.table_name)::regclass
          and idx.indisvalid
          and idx.indisready
          and (idx.indkey::int2[])[1:array_length(fkey_cols.attnums, 1)] = fkey_cols.attnums
      )
    )
    select * from missing_indexes
  loop
    cols := array_to_string(r.column_names, ', ');
    idx_name := format('idx_%s_%s_fk', r.table_name, array_to_string(r.column_names, '_'));
    if length(idx_name) > 60 then
      idx_name := substr(idx_name, 1, 50) || '_' || substr(md5(idx_name), 1, 10);
    end if;

    execute format(
      'create index if not exists %I on %I.%I (%s);',
      idx_name,
      r.schema_name,
      r.table_name,
      cols
    );
  end loop;
end $$;
