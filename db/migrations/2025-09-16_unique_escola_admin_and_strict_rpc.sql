-- db/migrations/2025-09-16_unique_escola_admin_and_strict_rpc.sql
-- 1) Ensure unique link between escola and admin user
do $$ begin
  -- Drop old name if previously added
  alter table if exists public.escola_administradores
    drop constraint if exists escola_administradores_escola_user_unique;
exception when others then null; end $$;

alter table if exists public.escola_administradores
  add constraint if not exists escola_administradores_escola_id_user_id_key
  unique (escola_id, user_id);

-- 2) Replace RPC to be stricter and use uniqueness
create or replace function public.create_escola_with_admin(
  p_nome text,
  p_nif text default null,
  p_endereco text default null,
  p_admin_email text default null,
  p_admin_telefone text default null,
  p_admin_nome text default null
)
returns json
language plpgsql
as $$
declare
  v_escola_id uuid;
  v_escola_nome text;
  v_msg text := '';
  v_user_id uuid;
  v_already boolean := false;
begin
  if p_nome is null or trim(p_nome) = '' then
    raise exception 'nome obrigatório' using errcode = 'P0001';
  end if;

  if p_nif is not null then
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    if length(p_nif) <> 9 then
      raise exception 'NIF inválido (9 dígitos)' using errcode = 'P0001';
    end if;
  end if;

  insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
  values (
    trim(p_nome),
    nullif(p_nif, ''),
    nullif(trim(coalesce(p_endereco, '')), ''),
    'ativa',
    false
  )
  returning id, nome into v_escola_id, v_escola_nome;

  if coalesce(trim(p_admin_email), '') <> '' then
    -- user must exist when provided (strict)
    select user_id
      into v_user_id
    from public.profiles
    where email = lower(trim(p_admin_email))
    limit 1;

    if v_user_id is null then
      raise exception 'Usuário administrador não encontrado' using errcode = 'P0001';
    end if;

    -- update profile data and ensure role/escola
    update public.profiles
       set telefone = coalesce(nullif(regexp_replace(coalesce(p_admin_telefone, ''), '\\D', '', 'g'), ''), telefone),
           nome = coalesce(nullif(trim(coalesce(p_admin_nome, '')), ''), nome),
           role = 'admin'::public.user_role,
           escola_id = coalesce(escola_id, v_escola_id)
     where user_id = v_user_id;

    -- idempotent link; not an error if already linked
    select exists(
      select 1 from public.escola_administradores
      where escola_id = v_escola_id and user_id = v_user_id
    ) into v_already;

    if not v_already then
      insert into public.escola_administradores (escola_id, user_id, cargo)
      values (v_escola_id, v_user_id, 'administrador_principal');
      v_msg := ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
    else
      v_msg := ' ✅ Administrador já estava vinculado: ' || lower(trim(p_admin_email));
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'escolaId', v_escola_id,
    'escolaNome', v_escola_nome,
    'mensagemAdmin', coalesce(v_msg, '')
  );
end;
$$;

grant execute on function public.create_escola_with_admin(text, text, text, text, text, text)
to anon, authenticated;
