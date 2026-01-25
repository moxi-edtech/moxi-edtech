create or replace function public.has_access_to_escola_fast(p_escola_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_users eu
    where eu.escola_id = p_escola_id
      and eu.user_id = auth.uid()
    limit 1
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.current_escola_id = p_escola_id or p.escola_id = p_escola_id)
    limit 1
  );
$$;

grant execute on function public.has_access_to_escola_fast(uuid) to authenticated;
