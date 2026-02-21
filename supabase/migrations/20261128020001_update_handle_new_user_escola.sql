create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_escola_id uuid;
begin
  v_escola_id := nullif(new.raw_user_meta_data->>'escola_id', '')::uuid;

  insert into public.profiles (
    user_id,
    nome,
    email,
    role,
    numero_login,
    telefone,
    onboarding_finalizado,
    escola_id,
    current_escola_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email,
    'encarregado'::user_role,
    coalesce(new.raw_user_meta_data->>'phone', new.phone, new.email),
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    false,
    v_escola_id,
    v_escola_id
  )
  on conflict (user_id) do update set
    nome = excluded.nome,
    email = excluded.email,
    numero_login = coalesce(excluded.numero_login, public.profiles.numero_login),
    telefone = coalesce(excluded.telefone, public.profiles.telefone),
    escola_id = coalesce(excluded.escola_id, public.profiles.escola_id),
    current_escola_id = coalesce(excluded.current_escola_id, public.profiles.current_escola_id);
  return new;
end;
$$;
