-- apps/web/supabase/migrations/20250916_create_escola_with_admin.sql
-- Creates a transactional RPC to create a school and optionally link an admin.

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
  v_user_escola_id uuid;
  v_exists int;
begin
  -- Basic validations
  if p_nome is null or trim(p_nome) = '' then
    raise exception 'nome obrigatório' using errcode = 'P0001';
  end if;

  if p_nif is not null then
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    if length(p_nif) <> 9 then
      raise exception 'NIF inválido (9 dígitos)' using errcode = 'P0001';
    end if;
  end if;

  -- Insert escola
  insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
  values (
    trim(p_nome),
    nullif(p_nif, ''),
    nullif(trim(coalesce(p_endereco, '')), ''),
    'ativa',
    false
  )
  returning id, nome into v_escola_id, v_escola_nome;

  -- Optional admin link
  if coalesce(trim(p_admin_email), '') <> '' then
    begin
      select user_id, escola_id
        into v_user_id, v_user_escola_id
      from public.profiles
      where email = lower(trim(p_admin_email))
      limit 1;

      if v_user_id is not null then
        update public.profiles
           set telefone = coalesce(regexp_replace(coalesce(p_admin_telefone, ''), '\\D', '', 'g'), telefone),
               nome = coalesce(nullif(trim(coalesce(p_admin_nome, '')), ''), nome),
               role = 'admin'::public.user_role,
               escola_id = coalesce(escola_id, v_escola_id)
         where user_id = v_user_id;

        -- Idempotent link (no unique constraint required)
        select 1 into v_exists from public.escola_administradores
         where escola_id = v_escola_id and user_id = v_user_id
         limit 1;
        if not found then
          insert into public.escola_administradores (escola_id, user_id, cargo)
          values (v_escola_id, v_user_id, 'administrador_principal');
        end if;

        v_msg := ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
      else
        v_msg := ' ⚠️ Usuário não encontrado. Vincule manualmente depois.';
      end if;
    exception when others then
      -- Do not fail the whole creation because of an optional admin link
      v_msg := ' ⚠️ Erro ao vincular administrador.';
    end;
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

-- Ensure PostgREST (Supabase) reloads its schema cache
notify pgrst, 'reload schema';
