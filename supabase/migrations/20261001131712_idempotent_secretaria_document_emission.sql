BEGIN;

-- BAL-GR-003
-- Idempotência canônica para emissão de documentos oficiais da Secretaria.
--
-- A chave fica no próprio artefacto emitido. Isso fecha a janela de falha entre
-- "documento persistido" e "resposta HTTP entregue": um retry consegue localizar
-- e devolver o mesmo docId mesmo que o processo web tenha morrido após o INSERT.
ALTER TABLE public.documentos_emitidos
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint text;

ALTER TABLE public.documentos_emitidos
  DROP CONSTRAINT IF EXISTS documentos_emitidos_idempotency_pair_chk;

ALTER TABLE public.documentos_emitidos
  ADD CONSTRAINT documentos_emitidos_idempotency_pair_chk
  CHECK (
    (idempotency_key IS NULL AND idempotency_fingerprint IS NULL)
    OR
    (
      idempotency_key IS NOT NULL
      AND idempotency_fingerprint IS NOT NULL
      AND length(btrim(idempotency_key)) BETWEEN 8 AND 200
      AND length(btrim(idempotency_fingerprint)) BETWEEN 16 AND 128
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_emitidos_escola_idempotency
  ON public.documentos_emitidos (escola_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.documentos_emitidos.idempotency_key IS
  'Chave de idempotência da emissão oficial; replay na mesma escola devolve o mesmo documento.';
COMMENT ON COLUMN public.documentos_emitidos.idempotency_fingerprint IS
  'Fingerprint do pedido associado à idempotency_key; impede reutilização da chave para outra emissão.';

-- Documentos finais continuam usando o contrato canônico emitir_documento_final.
-- Este wrapper adiciona serialização, replay e binding key -> request dentro da
-- MESMA transação da emissão original.
CREATE OR REPLACE FUNCTION public.emitir_documento_final_idempotente(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo integer,
  p_tipo_documento text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_fingerprint text;
  v_existing public.documentos_emitidos%ROWTYPE;
  v_result jsonb;
  v_doc_id uuid;
BEGIN
  IF length(v_key) < 8 OR length(v_key) > 200 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_INVALID: a chave deve ter entre 8 e 200 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: utilizador autenticado é obrigatório'
        USING ERRCODE = '42501';
    END IF;

    IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
      RAISE EXCEPTION 'AUTH_FORBIDDEN: escola fora do contexto autenticado'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin_secretaria',
        'admin',
        'admin_escola',
        'staff_admin',
        'diretor'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'AUTH_FORBIDDEN: sem permissão para emitir documento final'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_fingerprint := md5(
    p_escola_id::text || '|' ||
    p_aluno_id::text || '|' ||
    p_ano_letivo::text || '|' ||
    lower(btrim(coalesce(p_tipo_documento, '')))
  );

  -- Serializa retries concorrentes da mesma chave sem bloquear outras emissões.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_escola_id::text || ':secretaria_documentos_emitir:' || v_key,
      0
    )
  );

  SELECT *
    INTO v_existing
  FROM public.documentos_emitidos
  WHERE escola_id = p_escola_id
    AND idempotency_key = v_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.idempotency_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED: a chave já pertence a outra emissão'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'docId', v_existing.id,
      'publicId', v_existing.public_id,
      'hash', v_existing.hash_validacao,
      'tipo', v_existing.tipo,
      'idempotent', true
    );
  END IF;

  v_result := public.emitir_documento_final(
    p_escola_id,
    p_aluno_id,
    p_ano_letivo,
    p_tipo_documento
  );

  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE
     OR nullif(v_result->>'docId', '') IS NULL THEN
    RAISE EXCEPTION 'DOCUMENT_EMIT_FAILED: emissão final não devolveu documento';
  END IF;

  v_doc_id := (v_result->>'docId')::uuid;

  UPDATE public.documentos_emitidos
     SET idempotency_key = v_key,
         idempotency_fingerprint = v_fingerprint
   WHERE id = v_doc_id
     AND escola_id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_EMIT_FAILED: documento emitido não foi localizado';
  END IF;

  RETURN v_result || jsonb_build_object('idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_documento_final_idempotente(uuid, uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_documento_final_idempotente(uuid, uuid, integer, text, text)
  TO authenticated, service_role;

COMMIT;
