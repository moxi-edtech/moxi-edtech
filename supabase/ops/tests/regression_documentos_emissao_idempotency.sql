-- Regression test: BAL-GR-003 — official document emission idempotency.
--
-- Run after 20270826122000_idempotent_secretaria_document_emission.sql.
-- The test stubs the legacy final-document implementation inside this
-- transaction so it can exercise the idempotency wrapper without requiring a
-- complete academic-history fixture. ROLLBACK restores the real function.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._ensure_auth_user(p_id uuid, p_email text)
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

  INSERT INTO auth.users (
    instance_id, id, email, aud, role, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_id, p_email, 'authenticated', 'authenticated', 'not_used_in_sql_test',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

SELECT pg_temp._ensure_auth_user(
  '00000000-0000-4000-8000-000000001002'::uuid,
  'balcao.doc.secretaria@klasse.test'
);
SELECT pg_temp._ensure_auth_user(
  '00000000-0000-4000-8000-000000001003'::uuid,
  'balcao.doc.professor@klasse.test'
);
SELECT pg_temp._ensure_auth_user(
  '00000000-0000-4000-8000-000000001005'::uuid,
  'balcao.doc.financeiro@klasse.test'
);

INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
VALUES ('00000000-0000-4000-8000-000000001001'::uuid, 'Escola BAL-GR-003', 'ativa', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.alunos (id, escola_id, nome)
VALUES ('00000000-0000-4000-8000-000000001004'::uuid, '00000000-0000-4000-8000-000000001001'::uuid, 'Aluno BAL-GR-003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.escola_users (escola_id, user_id, role, papel)
VALUES
  (
    '00000000-0000-4000-8000-000000001001'::uuid,
    '00000000-0000-4000-8000-000000001002'::uuid,
    'staff',
    'secretaria'
  ),
  (
    '00000000-0000-4000-8000-000000001001'::uuid,
    '00000000-0000-4000-8000-000000001003'::uuid,
    'staff',
    'professor'
  ),
  (
    '00000000-0000-4000-8000-000000001001'::uuid,
    '00000000-0000-4000-8000-000000001005'::uuid,
    'staff',
    'financeiro'
  )
ON CONFLICT DO NOTHING;

-- Local-only stub. The outer transaction guarantees the original function is
-- restored by ROLLBACK even if an assertion fails under psql ON_ERROR_STOP.
CREATE OR REPLACE FUNCTION public.emitir_documento_final(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo integer,
  p_tipo_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_doc public.documentos_emitidos%ROWTYPE;
BEGIN
  INSERT INTO public.documentos_emitidos (
    escola_id,
    aluno_id,
    tipo,
    dados_snapshot,
    created_by,
    hash_validacao
  )
  VALUES (
    p_escola_id,
    p_aluno_id,
    p_tipo_documento::public.tipo_documento,
    jsonb_build_object(
      'ano_letivo', p_ano_letivo,
      'tipo_documento', p_tipo_documento,
      'test', 'BAL-GR-003'
    ),
    public.safe_auth_uid(),
    encode(sha256(gen_random_uuid()::text::bytea), 'hex')
  )
  RETURNING * INTO v_doc;

  RETURN jsonb_build_object(
    'ok', true,
    'docId', v_doc.id,
    'publicId', v_doc.public_id,
    'hash', v_doc.hash_validacao,
    'tipo', v_doc.tipo
  );
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_first jsonb;
  v_replay jsonb;
  v_count int;
  v_msg text;
  v_state text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000001002',
      'role', 'authenticated',
      'escola_id', '00000000-0000-4000-8000-000000001001'
    )::text,
    true
  );

  v_first := public.emitir_documento_final_idempotente(
    '00000000-0000-4000-8000-000000001001'::uuid,
    '00000000-0000-4000-8000-000000001004'::uuid,
    2026,
    'declaracao_notas',
    'bal-gr-003-retry-0001'
  );

  v_replay := public.emitir_documento_final_idempotente(
    '00000000-0000-4000-8000-000000001001'::uuid,
    '00000000-0000-4000-8000-000000001004'::uuid,
    2026,
    'declaracao_notas',
    'bal-gr-003-retry-0001'
  );

  IF v_first->>'docId' IS DISTINCT FROM v_replay->>'docId' THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: replay returned a different docId: % vs %',
      v_first->>'docId', v_replay->>'docId';
  END IF;

  IF coalesce((v_first->>'idempotent')::boolean, true) IS NOT FALSE THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: first response was not marked idempotent=false: %', v_first;
  END IF;

  IF coalesce((v_replay->>'idempotent')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: replay was not marked idempotent=true: %', v_replay;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.documentos_emitidos
  WHERE escola_id = '00000000-0000-4000-8000-000000001001'::uuid
    AND idempotency_key = 'bal-gr-003-retry-0001';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: expected exactly one document, got %', v_count;
  END IF;

  BEGIN
    PERFORM public.emitir_documento_final_idempotente(
      '00000000-0000-4000-8000-000000001001'::uuid,
      '00000000-0000-4000-8000-000000001004'::uuid,
      2026,
      'historico',
      'bal-gr-003-retry-0001'
    );
    RAISE EXCEPTION 'BAL-GR-003 failed: reused key with different payload was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF position('IDEMPOTENCY_KEY_REUSED' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-003 failed: expected IDEMPOTENCY_KEY_REUSED, got [%] %', v_state, v_msg;
    END IF;
  END;
END;
$$;

DO $$
DECLARE
  v_msg text;
  v_state text;
BEGIN
  -- Professor cannot exploit replay or new issuance through the privileged wrapper.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000001003',
      'role', 'authenticated',
      'escola_id', '00000000-0000-4000-8000-000000001001'
    )::text,
    true
  );

  BEGIN
    PERFORM public.emitir_documento_final_idempotente(
      '00000000-0000-4000-8000-000000001001'::uuid,
      '00000000-0000-4000-8000-000000001004'::uuid,
      2026,
      'declaracao_notas',
      'bal-gr-003-professor'
    );
    RAISE EXCEPTION 'BAL-GR-003 failed: professor call succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '42501' OR position('AUTH_FORBIDDEN' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-003 failed: expected AUTH_FORBIDDEN/42501, got [%] %', v_state, v_msg;
    END IF;
  END;
END;
$$;

DO $$
DECLARE
  v_msg text;
  v_state text;
BEGIN
  -- Financeiro is not part of K12_SECRETARIA_OPERACIONAL_ROLE_GROUP.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000001005',
      'role', 'authenticated',
      'escola_id', '00000000-0000-4000-8000-000000001001'
    )::text,
    true
  );

  BEGIN
    PERFORM public.emitir_documento_final_idempotente(
      '00000000-0000-4000-8000-000000001001'::uuid,
      '00000000-0000-4000-8000-000000001004'::uuid,
      2026,
      'declaracao_notas',
      'bal-gr-003-financeiro'
    );
    RAISE EXCEPTION 'BAL-GR-003 failed: financeiro call succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_state <> '42501' OR position('AUTH_FORBIDDEN' in v_msg) = 0 THEN
      RAISE EXCEPTION 'BAL-GR-003 failed: expected AUTH_FORBIDDEN/42501 for financeiro, got [%] %', v_state, v_msg;
    END IF;
  END;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_indexdef text;
BEGIN
  SELECT indexdef INTO v_indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'documentos_emitidos'
    AND indexname = 'ux_documentos_emitidos_escola_idempotency';

  IF v_indexdef IS NULL
     OR position('UNIQUE INDEX' in v_indexdef) = 0
     OR position('(escola_id, idempotency_key)' in v_indexdef) = 0 THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: unique document idempotency index missing: %', v_indexdef;
  END IF;

  IF has_function_privilege(
    'anon',
    'public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'BAL-GR-003 failed: anon has EXECUTE on idempotent wrapper';
  END IF;
END;
$$;

ROLLBACK;
