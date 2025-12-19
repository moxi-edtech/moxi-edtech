-- Migrate legacy table `public.escola_members` into `public.escola_usuarios` if present
do $$
declare
  has_papel_column boolean;
  has_role_column boolean;
begin
  if to_regclass('public.escola_members') is not null then
    -- Verifica se existe coluna 'papel' em escola_members
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'escola_members'
        and column_name = 'papel'
    ) into has_papel_column;

    -- Verifica se existe coluna 'role' em escola_members (caso seja o legado)
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'escola_members'
        and column_name = 'role'
    ) into has_role_column;

    if has_papel_column then
      -- Caso 1: tabela legacy já tenha 'papel'
      insert into public.escola_usuarios (escola_id, user_id, papel)
      select escola_id, user_id, papel
      from public.escola_members
      on conflict (escola_id, user_id)
      do update set papel = excluded.papel;

    elsif has_role_column then
      -- Caso 2: tabela legacy usa 'role' -> mapear para 'papel'
      insert into public.escola_usuarios (escola_id, user_id, papel)
      select
        escola_id,
        user_id,
        case
          when role in ('admin','staff_admin','financeiro','secretaria','aluno','professor','admin_escola')
            then role
          when role in ('owner','gestor','diretor')
            then 'admin_escola'
          else 'staff_admin' -- ajuste se quiser outra regra padrão
        end as papel
      from public.escola_members
      on conflict (escola_id, user_id)
      do update set papel = excluded.papel;

    else
      -- Caso 3: não tem 'papel' nem 'role' -> assume default
      insert into public.escola_usuarios (escola_id, user_id, papel)
      select
        escola_id,
        user_id,
        'admin_escola'::text
      from public.escola_members
      on conflict (escola_id, user_id)
      do nothing;
    end if;
  end if;
end $$;