create or replace function public.list_centro_formacao_team(p_escola_id uuid)
returns table (
  user_id uuid,
  papel text,
  created_at timestamptz,
  nome text,
  email text,
  role text,
  telefone text
)
language sql
security invoker
set search_path = public
as $$
  select
    eu.user_id,
    eu.papel::text as papel,
    eu.created_at,
    p.nome,
    p.email,
    p.role::text as role,
    p.telefone
  from public.escola_users eu
  inner join public.profiles p
    on p.user_id = eu.user_id
  where eu.escola_id = p_escola_id
  order by eu.created_at asc, p.email asc;
$$;

grant execute on function public.list_centro_formacao_team(uuid) to authenticated;
grant execute on function public.list_centro_formacao_team(uuid) to service_role;

