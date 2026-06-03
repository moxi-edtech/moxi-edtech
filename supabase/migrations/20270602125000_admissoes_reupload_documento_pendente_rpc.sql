BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_reupload_documento_pendente(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_document_id text,
  p_document_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cand public.candidaturas%ROWTYPE;
  v_document_id text := nullif(btrim(coalesce(p_document_id, '')), '');
  v_document_path text := nullif(btrim(coalesce(p_document_path, '')), '');
  v_pendencias jsonb := '[]'::jsonb;
  v_updated_pendencias jsonb := '[]'::jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_new_status text;
BEGIN
  IF p_escola_id IS NULL OR p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'Escola e candidatura são obrigatórias.';
  END IF;

  IF v_document_id IS NULL OR v_document_id !~ '^[A-Za-z0-9_-]{1,120}$' THEN
    RAISE EXCEPTION 'Documento inválido.';
  END IF;

  IF v_document_path IS NULL
    OR position('..' IN v_document_path) > 0
    OR left(v_document_path, 1) = '/'
    OR position(chr(92) IN v_document_path) > 0
    OR v_document_path NOT LIKE (p_escola_id::text || '/' || p_candidatura_id::text || '/%')
  THEN
    RAISE EXCEPTION 'Caminho do documento inválido.';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = p_escola_id
  FOR UPDATE;

  IF v_cand.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF lower(coalesce(v_cand.status, '')) <> 'pendente' THEN
    RAISE EXCEPTION 'Documento só pode ser reenviado para candidatura pendente.';
  END IF;

  IF jsonb_typeof(coalesce(v_cand.dados_candidato, '{}'::jsonb)) = 'object' THEN
    v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  END IF;

  IF jsonb_typeof(v_dados->'pendencias') = 'array' THEN
    v_pendencias := v_dados->'pendencias';
  END IF;

  IF jsonb_typeof(v_dados->'documentos') IS DISTINCT FROM 'object' THEN
    v_dados := jsonb_set(v_dados, '{documentos}', '{}'::jsonb, true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_pendencias) AS item(value)
    WHERE CASE jsonb_typeof(item.value)
      WHEN 'string' THEN trim(both '"' FROM item.value::text)
      WHEN 'object' THEN item.value->>'id'
      ELSE NULL
    END = v_document_id
  ) THEN
    RAISE EXCEPTION 'Documento não está pendente de correção.';
  END IF;

  SELECT coalesce(jsonb_agg(item.value), '[]'::jsonb)
  INTO v_updated_pendencias
  FROM jsonb_array_elements(v_pendencias) AS item(value)
  WHERE CASE jsonb_typeof(item.value)
    WHEN 'string' THEN trim(both '"' FROM item.value::text)
    WHEN 'object' THEN item.value->>'id'
    ELSE NULL
  END IS DISTINCT FROM v_document_id;

  v_dados := jsonb_set(
    v_dados,
    ARRAY['documentos', v_document_id],
    to_jsonb(v_document_path),
    true
  );
  v_dados := jsonb_set(v_dados, '{pendencias}', v_updated_pendencias, true);

  v_new_status :=
    CASE
      WHEN jsonb_array_length(v_updated_pendencias) = 0 THEN 'submetida'
      ELSE 'pendente'
    END;

  UPDATE public.candidaturas
  SET
    dados_candidato = v_dados,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = p_escola_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_new_status,
    'Reenvio de documento pendente via portal público',
    jsonb_build_object(
      'source', 'PORTAL_VAULT',
      'document_id', v_document_id,
      'document_path', v_document_path,
      'pendencias_restantes', jsonb_array_length(v_updated_pendencias)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_new_status,
    'document_id', v_document_id,
    'pendencias_restantes', jsonb_array_length(v_updated_pendencias)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admissao_reupload_documento_pendente(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_reupload_documento_pendente(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admissao_reupload_documento_pendente(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_reupload_documento_pendente(uuid, uuid, text, text) TO service_role;

COMMIT;
