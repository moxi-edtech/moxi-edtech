begin;

do $$
declare
  relkind "char";
begin
  select c.relkind
  into relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'escola_usuarios';

  if relkind = 'v' then
    execute 'drop view public.escola_usuarios';
  elsif relkind = 'r' then
    return;
  end if;

  execute 'create view public.escola_usuarios as
    select
      eu.id,
      eu.escola_id,
      eu.user_id,
      eu.papel,
      eu.created_at
    from public.escola_users eu';
end $$;

grant select on public.escola_usuarios to authenticated;

notify pgrst, 'reload schema';

commit;
