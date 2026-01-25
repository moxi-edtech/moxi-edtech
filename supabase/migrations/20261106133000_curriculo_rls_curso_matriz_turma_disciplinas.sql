begin;

drop policy if exists curso_matriz_select on public.curso_matriz;
drop policy if exists curso_matriz_insert on public.curso_matriz;
drop policy if exists curso_matriz_update on public.curso_matriz;

create policy curso_matriz_select
on public.curso_matriz
for select
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

create policy curso_matriz_insert
on public.curso_matriz
for insert
to authenticated
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

create policy curso_matriz_update
on public.curso_matriz
for update
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
)
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

drop policy if exists turma_disciplinas_select on public.turma_disciplinas;
drop policy if exists turma_disciplinas_insert on public.turma_disciplinas;
drop policy if exists turma_disciplinas_update on public.turma_disciplinas;

create policy turma_disciplinas_select
on public.turma_disciplinas
for select
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

create policy turma_disciplinas_insert
on public.turma_disciplinas
for insert
to authenticated
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

create policy turma_disciplinas_update
on public.turma_disciplinas
for update
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
)
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola','secretaria','admin'])
);

commit;
