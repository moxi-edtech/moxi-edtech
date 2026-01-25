do $$
declare
  r record;
begin
  for r in
    with index_defs as (
      select
        idx.indexrelid,
        idx.indrelid,
        idx.indkey,
        idx.indclass,
        idx.indcollation,
        idx.indoption,
        idx.indpred,
        idx.indexprs,
        idx.indisprimary,
        n.nspname as schema_name,
        c.relname as index_name
      from pg_index idx
      join pg_class c on c.oid = idx.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and idx.indisprimary = false
    ), duplicates as (
      select
        a.schema_name,
        a.index_name,
        b.index_name as other_index_name
      from index_defs a
      join index_defs b
        on a.indrelid = b.indrelid
       and a.indexrelid <> b.indexrelid
       and a.indkey = b.indkey
       and a.indclass = b.indclass
       and a.indcollation = b.indcollation
       and a.indoption = b.indoption
       and a.indpred is not distinct from b.indpred
       and a.indexprs is not distinct from b.indexprs
      where a.index_name like 'idx\_%\_fk'
    )
    select distinct schema_name, index_name
    from duplicates
  loop
    execute format('drop index if exists %I.%I', r.schema_name, r.index_name);
  end loop;
end $$;
