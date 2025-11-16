-- Migration: refine_matriculas_rls
-- Description: Restrict writes on public.matriculas to school staff only,
--              keep reads open to school members of the *current* tenant,
--              and preserve tenant isolation.

alter table if exists public.matriculas enable row level security;
alter table if exists public.matriculas force row level security;

-- Remover policies antigas que possam conflitar
drop policy if exists "Tenant Isolation" on public.matriculas;
drop policy if exists "matriculas_select_membro" on public.matriculas;
drop policy if exists "matriculas_insert_staff" on public.matriculas;
drop policy if exists "matriculas_update_staff" on public.matriculas;
drop policy if exists "matriculas_delete_staff" on public.matriculas;

-- SELECT: qualquer membro da escola atual pode ler
create policy "matriculas_select_membro"
on public.matriculas
for select
to authenticated
using (
  public.is_membro_escola(escola_id)
  and escola_id = public.current_tenant_escola_id()
);

-- INSERT: apenas staff pode inserir, e sempre dentro do tenant atual
create policy "matriculas_insert_staff"
on public.matriculas
for insert
to authenticated
with check (
  public.is_staff_escola(escola_id)
  and escola_id = public.current_tenant_escola_id()
);

-- UPDATE: apenas staff pode ler/atualizar, e sempre dentro do tenant atual
create policy "matriculas_update_staff"
on public.matriculas
for update
to authenticated
using (
  public.is_staff_escola(escola_id)
  and escola_id = public.current_tenant_escola_id()
)
with check (
  public.is_staff_escola(escola_id)
  and escola_id = public.current_tenant_escola_id()
);

-- DELETE: apenas staff pode apagar, dentro do tenant atual
create policy "matriculas_delete_staff"
on public.matriculas
for delete
to authenticated
using (
  public.is_staff_escola(escola_id)
  and escola_id = public.current_tenant_escola_id()
);
