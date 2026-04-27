-- Regression test: talent_pool_matches enforces verified-company gate and duplicate guard.
--
-- Validates:
-- 1) unverified company cannot INSERT (RLS/permission denied).
-- 2) verified company can INSERT.
-- 3) second INSERT for same (empresa_id, aluno_id) fails with unique violation (23505).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._tp_test_ensure_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (p_id, p_email)
    ON CONFLICT (id) DO NOTHING;
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO auth.users (
      id,
      email,
      aud,
      role,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    VALUES (
      p_id,
      p_email,
      'authenticated',
      'authenticated',
      'not_used_in_sql_test',
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      email,
      aud,
      role,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      p_id,
      p_email,
      'authenticated',
      'authenticated',
      'not_used_in_sql_test',
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
  END;
END;
$$;

DO $$
DECLARE
  v_escola_id uuid := gen_random_uuid();
  v_aluno_id uuid := gen_random_uuid();
  v_empresa_unverified uuid := gen_random_uuid();
  v_empresa_verified uuid := gen_random_uuid();
  v_msg text;
  v_state text;
BEGIN
  PERFORM pg_temp._tp_test_ensure_auth_user(v_empresa_unverified, 'talentpool.unverified@gmail.com');
  PERFORM pg_temp._tp_test_ensure_auth_user(v_empresa_verified, 'talentpool.verified@unitel.ao');

  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES (v_escola_id, 'Escola Talent Pool RLS', 'ativa', true);

  INSERT INTO public.alunos (id, escola_id, nome, is_open_to_work, anonymous_slug)
  VALUES (
    v_aluno_id,
    v_escola_id,
    'Aluno Talent Pool RLS',
    true,
    'talent-rls-' || substring(replace(v_aluno_id::text, '-', '') from 1 for 8)
  );

  -- Whitelist de domínio para ativar fast-track da empresa verificada.
  INSERT INTO public.empresas_parceiras_dominios_verificados (dominio, empresa_nome, is_active)
  VALUES ('unitel.ao', 'Unitel Test', true)
  ON CONFLICT (dominio) DO UPDATE
    SET is_active = EXCLUDED.is_active;

  INSERT INTO public.empresas_parceiras (id, nif)
  VALUES (v_empresa_unverified, 'NIF-TP-UNVERIFIED-' || substring(replace(v_empresa_unverified::text, '-', '') from 1 for 8))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.empresas_parceiras (id, nif)
  VALUES (v_empresa_verified, 'NIF-TP-VERIFIED-' || substring(replace(v_empresa_verified::text, '-', '') from 1 for 8))
  ON CONFLICT (id) DO NOTHING;

  -- 1) Não verificada: INSERT deve falhar por RLS/permissão.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_empresa_unverified::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    INSERT INTO public.talent_pool_matches (empresa_id, aluno_id, status)
    VALUES (v_empresa_unverified, v_aluno_id, 'pending');

    RAISE EXCEPTION 'Teste falhou: empresa não verificada inseriu match com sucesso';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF NOT (
      v_state = '42501'
      OR position('row-level security' in lower(v_msg)) > 0
      OR position('permission denied' in lower(v_msg)) > 0
    ) THEN
      RAISE EXCEPTION 'Teste falhou: erro inesperado para empresa não verificada [%] %', v_state, v_msg;
    END IF;
  END;

  -- 2) Verificada: primeiro INSERT deve passar.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_empresa_verified::text, 'role', 'authenticated')::text,
    true
  );

  INSERT INTO public.talent_pool_matches (empresa_id, aluno_id, status)
  VALUES (v_empresa_verified, v_aluno_id, 'pending');

  -- 3) Mesmo par empresa/aluno: deve falhar com unique violation 23505.
  BEGIN
    INSERT INTO public.talent_pool_matches (empresa_id, aluno_id, status)
    VALUES (v_empresa_verified, v_aluno_id, 'pending');

    RAISE EXCEPTION 'Teste falhou: expected unique violation (23505) para match duplicado';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '23505' THEN
      RAISE EXCEPTION 'Teste falhou: expected SQLSTATE 23505, obtido [%] %', v_state, v_msg;
    END IF;
  END;
END;
$$;

ROLLBACK;
