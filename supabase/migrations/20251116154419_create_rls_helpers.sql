-- Migration: create_rls_helpers
-- Description: Creates helper functions for RLS policies to check user roles.

-- Helper to check if a user is a member of a specific school
create or replace function public.is_membro_escola(escola_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
  );
$$;

-- Helper to check if a user is staff (admin or secretaria) in a specific school
create or replace function public.is_staff_escola(escola_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
      and eu.papel in ('admin_escola', 'secretaria', 'staff_admin')
  );
$$;

grant execute on function public.is_membro_escola(uuid) to authenticated;
grant execute on function public.is_staff_escola(uuid) to authenticated;
