begin;

drop policy if exists periodos_letivos_select on public.periodos_letivos;

create policy periodos_letivos_select
on public.periodos_letivos
for select
to authenticated
using (escola_id = public.current_tenant_escola_id());

commit;
