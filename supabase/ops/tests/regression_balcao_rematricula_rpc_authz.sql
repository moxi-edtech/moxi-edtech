-- Regression test: BAL-GR-001 — finalizar_rematricula_balcao authorization boundary.
--
-- Validates:
-- 1) unauthenticated caller is denied before domain lookup;
-- 2) authenticated user without an allowed K12 operational role is denied;
-- 3) an allowed user cannot operate another school;
-- 4) secretaria of the requested school passes authz and reaches domain validation;
-- 5) the RPC remains SECURITY DEFINER with a pinned empty search_path and is
--    not executable by anon.
--
-- This test does not need a complete rematricula fixture. Authorized calls use
-- deliberately nonexistent domain IDs: reaching "Ano letivo destino inválido"
-- proves that the authorization gate was passed.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._balcao_authz_ensure_auth_user(
  p_id uuid,
  p_email text
)
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

SELECT pg_temp._balcao_authz_ensure_auth_user(
  '00000000-0000-4000-8000-000000000902'::uuid,
  'balcao.authz.secretaria@klasse.test'
);
SELECT pg_temp._balcao_authz_ensure_auth_user(
  '00000000-0000-4000-8000-000000000903'::uuid,
  'balcao.authz.professor@klasse.test'
);
SELECT pg_temp._balcao_authz_ensure_auth_user(
  '00000000-0000-4000-8000-000000000904'::uuid,
  'balcao.authz.outsider@klasse.test'
);

INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
VALUES
  ('00000000-0000-4000-8000-000000000901'::uuid, 'Escola BAL-GR-001 A', 'ativa', true),
  ('00000000-0000-4000-8000-000000000905'::uuid, 'Escola BAL-GR-001 B', 'ativa', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.escola_users (escola_id, user_id, role, papel)
VALUES
  (
    '00000000-0000-4000-8000-000000000901'::uuid,
    '00000000-0000-4000-8000-000000000902'::uuid,
    'staff',
    'secretaria'
  ),
  (
    '00000000-0000-4000-8000-000000000901'::uuid,
    '00000000-0000-4000-8000-000000000903'::uuid,
    'staff',
    'professor'
  )
ON CONFLICT DO NOTHING;

-- Run the actual calls as the Data API database role, not as postgres.
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_msg text;
  v_state text;
BEGIN
  -- 1) No subject: must fail at the auth boundary.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      '00000000-0000-4000-8000-000000000901'::uuid,
      '00000000-0000-4000-8000-000000000911'::uuid,
      '00000000-0000-4000-8000-000000000912'::uuid,
      '00000000-0000-4000-8000-000000000913'::uuid,
      '00000000-0000-4000-8000-000000000914'::uuid,
      '00000000-0000-4000-8000-000000000915'::uuid
    );
    RAISE EXCEPTION 'BAL-GR-001 failed: unauthenticated call succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '42501' OR position('AUTH_REQUIRED' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-001 failed: expected AUTH_REQUIRED/42501, got [%] %', v_state, v_msg;
    END IF;
  END;

  -- 2) Professor is authenticated but not allowed to finalize at the Balcao.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000000903',
      'role', 'authenticated'
    )::text,
    true
  );

  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      '00000000-0000-4000-8000-000000000901'::uuid,
      '00000000-0000-4000-8000-000000000911'::uuid,
      '00000000-0000-4000-8000-000000000912'::uuid,
      '00000000-0000-4000-8000-000000000913'::uuid,
      '00000000-0000-4000-8000-000000000914'::uuid,
      '00000000-0000-4000-8000-000000000915'::uuid
    );
    RAISE EXCEPTION 'BAL-GR-001 failed: professor call succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '42501' OR position('AUTH_FORBIDDEN' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-001 failed: expected AUTH_FORBIDDEN/42501 for professor, got [%] %', v_state, v_msg;
    END IF;
  END;

  -- 3) Secretaria is valid only for its own school.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000000902',
      'role', 'authenticated'
    )::text,
    true
  );

  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      '00000000-0000-4000-8000-000000000905'::uuid,
      '00000000-0000-4000-8000-000000000911'::uuid,
      '00000000-0000-4000-8000-000000000912'::uuid,
      '00000000-0000-4000-8000-000000000913'::uuid,
      '00000000-0000-4000-8000-000000000914'::uuid,
      '00000000-0000-4000-8000-000000000915'::uuid
    );
    RAISE EXCEPTION 'BAL-GR-001 failed: cross-tenant call succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '42501' OR position('AUTH_FORBIDDEN' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-001 failed: expected cross-tenant AUTH_FORBIDDEN/42501, got [%] %', v_state, v_msg;
    END IF;
  END;

  -- 4) Secretaria in the requested school must pass the authz gate. The fake
  -- academic-year id should be the first domain error reached.
  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      '00000000-0000-4000-8000-000000000901'::uuid,
      '00000000-0000-4000-8000-000000000911'::uuid,
      '00000000-0000-4000-8000-000000000912'::uuid,
      '00000000-0000-4000-8000-000000000913'::uuid,
      '00000000-0000-4000-8000-000000000914'::uuid,
      '00000000-0000-4000-8000-000000000915'::uuid
    );
    RAISE EXCEPTION 'BAL-GR-001 failed: fake domain call unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state = '42501' THEN
      RAISE EXCEPTION 'BAL-GR-001 failed: authorized secretaria was denied [%] %', v_state, v_msg;
    END IF;
    IF position('Ano letivo destino inválido' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-001 failed: expected domain validation after authz, got [%] %', v_state, v_msg;
    END IF;
  END;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_oid oid;
  v_search_path text[];
BEGIN
  SELECT p.oid, p.proconfig
    INTO v_oid, v_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'finalizar_rematricula_balcao'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'BAL-GR-001 failed: RPC not found';
  END IF;

  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
    RAISE EXCEPTION 'BAL-GR-001 failed: expected SECURITY DEFINER contract to remain unchanged in this patch';
  END IF;

  IF NOT ('search_path=""' = ANY(coalesce(v_search_path, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'BAL-GR-001 failed: SECURITY DEFINER search_path is not pinned empty: %', v_search_path;
  END IF;

  IF has_function_privilege(
    'anon',
    'public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-001 failed: anon still has EXECUTE';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-001 failed: authenticated lost EXECUTE unexpectedly';
  END IF;
END;
$$;

ROLLBACK;
