-- Migration: refine_classes_turmas_rls
-- Description: Updates RLS policies for public.classes and public.turmas.
--              - Any school member can read (SELECT).
--              - Only staff can write (INSERT, UPDATE, DELETE).

-- ===== public.classes =====

-- Drop old policies
drop policy if exists "select_own_classes" on public.classes;
drop policy if exists "insert_own_classes" on public.classes;
drop policy if exists "update_own_classes" on public.classes;
drop policy if exists "delete_own_classes" on public.classes;

-- SELECT: Any authenticated member of the school can view classes.
create policy "classes_select_membro"
on public.classes
for select
to authenticated
using (
  public.is_membro_escola(classes.escola_id)
);

-- INSERT: Only staff can create classes.
create policy "classes_insert_staff"
on public.classes
for insert
to authenticated
with check (
  public.is_staff_escola(classes.escola_id)
);

-- UPDATE: Only staff can update classes.
create policy "classes_update_staff"
on public.classes
for update
to authenticated
using (
  public.is_staff_escola(classes.escola_id)
)
with check (
  public.is_staff_escola(classes.escola_id)
);

-- DELETE: Only staff can delete classes.
create policy "classes_delete_staff"
on public.classes
for delete
to authenticated
using (
  public.is_staff_escola(classes.escola_id)
);


-- ===== public.turmas =====

-- Drop old policies
drop policy if exists "select_own_turmas" on public.turmas;
drop policy if exists "insert_own_turmas" on public.turmas;
drop policy if exists "update_own_turmas" on public.turmas;
drop policy if exists "delete_own_turmas" on public.turmas;
drop policy if exists "turmas select membros escola" on public.turmas;
drop policy if exists "turmas insert membros escola" on public.turmas;
drop policy if exists "turmas update membros escola" on public.turmas;
drop policy if exists "turmas delete membros escola" on public.turmas;


-- SELECT: Any authenticated member of the school can view turmas.
create policy "turmas_select_membro"
on public.turmas
for select
to authenticated
using (
  public.is_membro_escola(turmas.escola_id)
);

-- INSERT: Only staff can create turmas.
create policy "turmas_insert_staff"
on public.turmas
for insert
to authenticated
with check (
  public.is_staff_escola(turmas.escola_id)
);

-- UPDATE: Only staff can update turmas.
create policy "turmas_update_staff"
on public.turmas
for update
to authenticated
using (
  public.is_staff_escola(turmas.escola_id)
)
with check (
  public.is_staff_escola(turmas.escola_id)
);

-- DELETE: Only staff can delete turmas.
create policy "turmas_delete_staff"
on public.turmas
for delete
to authenticated
using (
  public.is_staff_escola(turmas.escola_id)
);
