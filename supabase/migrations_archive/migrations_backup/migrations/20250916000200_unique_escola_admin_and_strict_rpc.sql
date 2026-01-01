-- apps/web/supabase/migrations/20250916_unique_escola_admin_and_strict_rpc.sql
-- 1) Ensure unique link between escola and admin user
do $$ begin
  -- Drop old name if previously added
  alter table if exists public.escola_administradores
    drop constraint if exists escola_administradores_escola_user_unique;
exception when others then null; end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'escola_administradores'
      and c.conname = 'escola_administradores_escola_id_user_id_key'
  ) then
    alter table public.escola_administradores
      add constraint escola_administradores_escola_id_user_id_key
      unique (escola_id, user_id);
  end if;
end $$;

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

-- Ensure PostgREST (Supabase) reloads its schema cache
notify pgrst, 'reload schema';
-- Safely add unique constraint and create function only if tables exist
DO $$ 
BEGIN
    -- Add unique constraint only if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'escola_administradores'
    ) THEN
        -- Drop old name if previously added
        ALTER TABLE IF EXISTS public.escola_administradores
        DROP CONSTRAINT IF EXISTS escola_administradores_escola_user_unique;

        -- Add new constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'escola_administradores'
              AND c.conname = 'escola_administradores_escola_id_user_id_key'
        ) THEN
            ALTER TABLE public.escola_administradores
            ADD CONSTRAINT escola_administradores_escola_id_user_id_key
            UNIQUE (escola_id, user_id);
        END IF;
    END IF;
END $$;

-- Safely create or replace function
CREATE OR REPLACE FUNCTION public.create_escola_with_admin(
  p_nome text,
  p_nif text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_admin_email text DEFAULT NULL,
  p_admin_telefone text DEFAULT NULL,
  p_admin_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid;
  v_escola_nome text;
  v_msg text := '';
  v_user_id uuid;
  v_already boolean := false;
BEGIN
  -- Check if escolas table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'escolas'
  ) THEN
    RETURN json_build_object(
      'ok', false,
      'erro', 'Tabela escolas não existe'
    );
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'nome obrigatório' USING errcode = 'P0001';
  END IF;

  IF p_nif IS NOT NULL THEN
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    IF length(p_nif) <> 9 THEN
      RAISE EXCEPTION 'NIF inválido (9 dígitos)' USING errcode = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.escolas (nome, nif, endereco, status, onboarding_finalizado)
  VALUES (
    trim(p_nome),
    NULLIF(p_nif, ''),
    NULLIF(trim(COALESCE(p_endereco, '')), ''),
    'ativa',
    false
  )
  RETURNING id, nome INTO v_escola_id, v_escola_nome;

  -- Check if profiles table exists before trying to link admin
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND COALESCE(trim(p_admin_email), '') <> '' THEN
    -- user must exist when provided (strict)
    SELECT user_id
    INTO v_user_id
    FROM public.profiles
    WHERE email = lower(trim(p_admin_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Usuário administrador não encontrado' USING errcode = 'P0001';
    END IF;

    -- update profile data and ensure role/escola
    UPDATE public.profiles
    SET telefone = COALESCE(NULLIF(regexp_replace(COALESCE(p_admin_telefone, ''), '\\D', '', 'g'), ''), telefone),
        nome = COALESCE(NULLIF(trim(COALESCE(p_admin_nome, '')), ''), nome),
        role = 'admin'::public.user_role,
        escola_id = COALESCE(escola_id, v_escola_id)
    WHERE user_id = v_user_id;

    -- Check if escola_administradores table exists before linking
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'escola_administradores'
    ) THEN
      -- idempotent link; not an error if already linked
      SELECT EXISTS(
        SELECT 1 FROM public.escola_administradores
        WHERE escola_id = v_escola_id AND user_id = v_user_id
      ) INTO v_already;

      IF NOT v_already THEN
        INSERT INTO public.escola_administradores (escola_id, user_id, cargo)
        VALUES (v_escola_id, v_user_id, 'administrador_principal');
        v_msg := ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
      ELSE
        v_msg := ' ✅ Administrador já estava vinculado: ' || lower(trim(p_admin_email));
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'escolaId', v_escola_id,
    'escolaNome', v_escola_nome,
    'mensagemAdmin', COALESCE(v_msg, '')
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_escola_with_admin(text, text, text, text, text, text)
TO anon, authenticated;

-- Notify PostgREST (safe to run even if not needed)
NOTIFY pgrst, 'reload schema';
