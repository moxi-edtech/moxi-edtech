-- Regression test: BAL-GR-001 blocks direct cross-tenant invocation of
-- public.finalizar_rematricula_balcao while preserving the legitimate
-- authenticated same-school path.
--
-- Run after applying 20261001130312_harden_balcao_rematricula_rpc_authz.sql.
-- The transaction always rolls back its fixtures.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_escola_allowed uuid := gen_random_uuid();
  v_escola_forbidden uuid := gen_random_uuid();
  v_state text;
  v_msg text;
BEGIN
  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES
    (v_escola_allowed, 'Escola BAL-GR-001 Permitida', 'ativa', true),
    (v_escola_forbidden, 'Escola BAL-GR-001 Bloqueada', 'ativa', true);

  INSERT INTO public.profiles (
    user_id,
    email,
    nome,
    role,
    escola_id,
    current_escola_id
  )
  VALUES (
    v_user_id,
    'bal-gr-001@example.test',
    'BAL GR 001',
    'secretaria',
    v_escola_allowed,
    v_escola_allowed
  );

  INSERT INTO public.escola_users (escola_id, user_id, papel)
  VALUES (v_escola_allowed, v_user_id, 'secretaria');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_user_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  -- 1) Direct cross-tenant call must fail at the authorization boundary,
  -- before any domain lookup can reveal or mutate the target school.
  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      v_escola_forbidden,
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid()
    );

    RAISE EXCEPTION
      'BAL-GR-001 regression: cross-tenant direct RPC call unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_msg = MESSAGE_TEXT;

    IF v_state <> '42501' OR v_msg <> 'BALCAO_REMATRICULA_FORBIDDEN' THEN
      RAISE EXCEPTION
        'BAL-GR-001 regression: expected 42501/BALCAO_REMATRICULA_FORBIDDEN, got [%] %',
        v_state,
        v_msg;
    END IF;
  END;

  -- 2) Same-school secretaria must pass authorization. Random domain IDs then
  -- fail at the first business validation, proving the auth guard did not
  -- over-block the legitimate role.
  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
      v_escola_allowed,
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid()
    );

    RAISE EXCEPTION
      'BAL-GR-001 regression: expected domain validation failure for fake IDs';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_msg = MESSAGE_TEXT;

    IF v_msg = 'BALCAO_REMATRICULA_FORBIDDEN'
       OR v_msg = 'BALCAO_REMATRICULA_UNAUTHENTICATED' THEN
      RAISE EXCEPTION
        'BAL-GR-001 regression: legitimate same-school secretaria was blocked [%] %',
        v_state,
        v_msg;
    END IF;

    IF position('Ano letivo destino inválido' in v_msg) = 0 THEN
      RAISE EXCEPTION
        'BAL-GR-001 regression: expected domain validation after auth, got [%] %',
        v_state,
        v_msg;
    END IF;
  END;

  -- 3) The public RPC surface is authenticated-only.
  IF has_function_privilege(
    'anon',
    'public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-001 regression: anon still has EXECUTE';
  END IF;

  IF has_function_privilege(
    'service_role',
    'public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-001 regression: service_role still has EXECUTE';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-001 regression: authenticated lost EXECUTE';
  END IF;
END;
$$;

ROLLBACK;
