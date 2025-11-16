-- Migration: refine_alunos_rls
-- Description: Updates RLS policies for public.alunos to be role-based.
--              - Staff can manage all students in their school.
--              - Students can only see their own record.

-- Drop the old, broad policies
drop policy if exists "alunos_select_own" on public.alunos;
drop policy if exists "alunos_insert_own" on public.alunos;
drop policy if exists "alunos_update_own" on public.alunos;
drop policy if exists "alunos_delete_own" on public.alunos;

-- SELECT: Staff sees all in school, student sees own record.
create policy "alunos_select_por_escola_ou_proprio"
on public.alunos
for select
to authenticated
using (
  -- Staff (Admin / Secretaria) can see all students in their school
  public.is_staff_escola(alunos.escola_id)
  -- OR the student can see their own record by linking through the profiles table
  or exists (
    select 1
    from public.profiles p
    where p.user_id = alunos.profile_id
      and p.user_id = (select auth.uid())
  )
);

-- INSERT: Only staff can create students.
create policy "alunos_insert_staff"
on public.alunos
for insert
to authenticated
with check (
  public.is_staff_escola(alunos.escola_id)
);

-- UPDATE: Only staff can update students.
create policy "alunos_update_staff"
on public.alunos
for update
to authenticated
using (
  public.is_staff_escola(alunos.escola_id)
)
with check (
  public.is_staff_escola(alunos.escola_id)
);

-- DELETE: Only staff can delete students.
create policy "alunos_delete_staff"
on public.alunos
for delete
to authenticated
using (
  public.is_staff_escola(alunos.escola_id)
);
