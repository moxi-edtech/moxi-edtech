BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_marcar_pendencias_documentos(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_pendencias jsonb,
  p_motivo text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand public.candidaturas%ROWTYPE;
  v_pendencias jsonb := '[]'::jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF p_escola_id IS NULL OR p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'Escola e candidatura são obrigatórias.';
  END IF;

  IF p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','diretor','admin','admin_escola','staff_admin']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  IF jsonb_typeof(coalesce(p_pendencias, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(coalesce(p_pendencias, '[]'::jsonb)) = 0
    OR jsonb_array_length(coalesce(p_pendencias, '[]'::jsonb)) > 20
  THEN
    RAISE EXCEPTION 'Informe pelo menos uma pendência documental válida.';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'label', item.label,
        'motivo', item.motivo
      )
      ORDER BY item.label
    ),
    '[]'::jsonb
  )
  INTO v_pendencias
  FROM (
    SELECT DISTINCT ON (lower(btrim(value->>'id')))
      lower(btrim(value->>'id')) AS id,
      left(nullif(btrim(value->>'label'), ''), 120) AS label,
      left(nullif(btrim(value->>'motivo'), ''), 500) AS motivo
    FROM jsonb_array_elements(p_pendencias) AS raw(value)
    WHERE jsonb_typeof(raw.value) = 'object'
      AND lower(btrim(raw.value->>'id')) ~ '^[a-z0-9_-]{1,120}$'
      AND nullif(btrim(raw.value->>'label'), '') IS NOT NULL
      AND nullif(btrim(raw.value->>'motivo'), '') IS NOT NULL
    ORDER BY lower(btrim(value->>'id')), left(nullif(btrim(value->>'label'), ''), 120)
  ) AS item;

  IF jsonb_array_length(v_pendencias) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos uma pendência documental válida.';
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

  IF lower(coalesce(v_cand.status, '')) IN ('matriculado', 'rejeitada', 'arquivado') THEN
    RAISE EXCEPTION 'Candidatura finalizada não pode receber pendência documental.';
  END IF;

  IF jsonb_typeof(coalesce(v_cand.dados_candidato, '{}'::jsonb)) = 'object' THEN
    v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  END IF;

  v_dados := jsonb_set(v_dados, '{pendencias}', v_pendencias, true);
  v_dados := jsonb_set(v_dados, '{pendencia_motivo}', to_jsonb(v_motivo), true);
  v_dados := jsonb_set(v_dados, '{pendencia_at}', to_jsonb(now()), true);

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = 'pendente',
    expires_at = NULL,
    dados_candidato = v_dados,
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
    'pendente',
    coalesce(v_motivo, 'Pendência documental solicitada pela secretaria'),
    jsonb_build_object(
      'source', 'SECRETARIA',
      'tipo', 'DOCUMENTOS_PENDENTES',
      'pendencias', v_pendencias
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'pendente',
    'pendencias', v_pendencias
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admissao_marcar_pendencias_documentos(uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_marcar_pendencias_documentos(uuid, uuid, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.admissao_marcar_pendencias_documentos(uuid, uuid, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_marcar_pendencias_documentos(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_marcar_pendencias_documentos(uuid, uuid, jsonb, text) TO service_role;

COMMIT;
