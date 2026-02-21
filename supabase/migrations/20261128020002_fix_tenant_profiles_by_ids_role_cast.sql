create or replace function public.tenant_profiles_by_ids(
  p_user_ids uuid[]
)
returns table(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_login text,
  escola_id uuid,
  current_escola_id uuid,
  created_at timestamptz,
  last_login timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
begin
  if auth.role() <> 'service_role' and not public.is_super_or_global_admin() and v_escola_id is null then
    return;
  end if;

  return query
  select
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role::text,
    p.numero_login,
    p.escola_id,
    p.current_escola_id,
    p.created_at,
    u.last_sign_in_at as last_login
  from public.profiles p
  left join auth.users u on u.id = p.user_id
  where p.user_id = any(p_user_ids)
    and (
      public.is_super_or_global_admin()
      or auth.role() = 'service_role'
      or p.user_id in (
        select eu.user_id
        from public.escola_users eu
        where eu.escola_id = v_escola_id
      )
    );
end;
$$;
