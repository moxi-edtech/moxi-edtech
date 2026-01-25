begin;

drop policy if exists anos_letivos_select on public.anos_letivos;

create policy anos_letivos_select
on public.anos_letivos
for select
to authenticated
using (escola_id = public.current_tenant_escola_id());

commit;
