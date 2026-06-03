BEGIN;

ALTER TABLE public.escolas
  ALTER COLUMN config_portal_admissao SET DEFAULT '{
    "campos_extras": [],
    "whatsapp_suporte": null,
    "exibir_vagas": false,
    "termos_condicoes_url": null,
    "reserva_expiracao_horas": 48,
    "pendencia_sla_horas": 72,
    "documentos_admissao_catalogo": [
      { "id": "bi_candidato", "label": "BI do candidato" },
      { "id": "foto_candidato", "label": "Fotografia do candidato" },
      { "id": "certificado_habilitacoes", "label": "Certificado ou declaração" },
      { "id": "bi_encarregado", "label": "BI do encarregado" }
    ]
  }'::jsonb;

UPDATE public.escolas
SET config_portal_admissao = coalesce(config_portal_admissao, '{}'::jsonb)
  || jsonb_build_object(
    'pendencia_sla_horas',
    CASE
      WHEN coalesce(config_portal_admissao->>'pendencia_sla_horas', '') ~ '^[0-9]+$'
        THEN greatest(1, least(720, (config_portal_admissao->>'pendencia_sla_horas')::integer))
      ELSE 72
    END,
    'documentos_admissao_catalogo',
    CASE
      WHEN jsonb_typeof(config_portal_admissao->'documentos_admissao_catalogo') = 'array'
        AND jsonb_array_length(config_portal_admissao->'documentos_admissao_catalogo') > 0
        THEN config_portal_admissao->'documentos_admissao_catalogo'
      ELSE '[
        { "id": "bi_candidato", "label": "BI do candidato" },
        { "id": "foto_candidato", "label": "Fotografia do candidato" },
        { "id": "certificado_habilitacoes", "label": "Certificado ou declaração" },
        { "id": "bi_encarregado", "label": "BI do encarregado" }
      ]'::jsonb
    END
  );

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
  v_catalogo jsonb := '[]'::jsonb;
  v_sla_horas integer := 72;
  v_pendencia_expira_at timestamptz;
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

  SELECT
    CASE
      WHEN jsonb_typeof(e.config_portal_admissao->'documentos_admissao_catalogo') = 'array'
        AND jsonb_array_length(e.config_portal_admissao->'documentos_admissao_catalogo') > 0
        THEN e.config_portal_admissao->'documentos_admissao_catalogo'
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN coalesce(e.config_portal_admissao->>'pendencia_sla_horas', '') ~ '^[0-9]+$'
        THEN greatest(1, least(720, (e.config_portal_admissao->>'pendencia_sla_horas')::integer))
      ELSE 72
    END
  INTO v_catalogo, v_sla_horas
  FROM public.escolas e
  WHERE e.id = p_escola_id;

  v_pendencia_expira_at := now() + make_interval(hours => coalesce(v_sla_horas, 72));

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'label', item.label,
        'motivo', item.motivo,
        'custom', item.custom
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
      left(nullif(btrim(value->>'motivo'), ''), 500) AS motivo,
      coalesce((value->>'custom')::boolean, false) AS custom
    FROM jsonb_array_elements(p_pendencias) AS raw(value)
    WHERE jsonb_typeof(raw.value) = 'object'
      AND lower(btrim(raw.value->>'id')) ~ '^[a-z0-9_-]{1,120}$'
      AND nullif(btrim(raw.value->>'label'), '') IS NOT NULL
      AND nullif(btrim(raw.value->>'motivo'), '') IS NOT NULL
      AND (
        coalesce((raw.value->>'custom')::boolean, false)
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_catalogo) AS catalog(value)
          WHERE lower(btrim(catalog.value->>'id')) = lower(btrim(raw.value->>'id'))
        )
      )
    ORDER BY lower(btrim(value->>'id')), left(nullif(btrim(value->>'label'), ''), 120)
  ) AS item;

  IF jsonb_array_length(v_pendencias) = 0 THEN
    RAISE EXCEPTION 'Use documentos do catálogo ou marque o item como extra.';
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
  v_dados := jsonb_set(v_dados, '{pendencia_expira_at}', to_jsonb(v_pendencia_expira_at), true);
  v_dados := jsonb_set(v_dados, '{pendencia_sla_horas}', to_jsonb(coalesce(v_sla_horas, 72)), true);

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
    actor_user_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    auth.uid(),
    v_cand.status,
    'pendente',
    coalesce(v_motivo, 'Pendência documental solicitada pela secretaria'),
    jsonb_build_object(
      'source', 'SECRETARIA',
      'tipo', 'DOCUMENTOS_PENDENTES',
      'pendencias', v_pendencias,
      'pendencia_sla_horas', coalesce(v_sla_horas, 72),
      'pendencia_expira_at', v_pendencia_expira_at
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'pendente',
    'pendencias', v_pendencias,
    'pendencia_expira_at', v_pendencia_expira_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_revisar_documentos_reenviados(
  p_escola_id uuid,
  p_candidatura_id uuid,
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

  SELECT *
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = p_escola_id
  FOR UPDATE;

  IF v_cand.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF lower(coalesce(v_cand.status, '')) <> 'documentos_reenviados' THEN
    RAISE EXCEPTION 'Apenas candidaturas com documentos re-enviados podem ser aceites nesta ação.';
  END IF;

  IF jsonb_typeof(coalesce(v_cand.dados_candidato, '{}'::jsonb)) = 'object' THEN
    v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  END IF;

  v_dados := jsonb_set(v_dados, '{pendencias}', '[]'::jsonb, true);
  v_dados := v_dados - 'pendencia_expira_at' - 'pendencia_motivo';
  v_dados := jsonb_set(v_dados, '{documentos_revisados_at}', to_jsonb(now()), true);

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = 'submetida',
    dados_candidato = v_dados,
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = p_escola_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    actor_user_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    auth.uid(),
    v_cand.status,
    'submetida',
    coalesce(v_motivo, 'Documentos re-enviados aceites pela secretaria'),
    jsonb_build_object(
      'source', 'SECRETARIA',
      'tipo', 'DOCUMENTOS_REENVIADOS_ACEITES'
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', 'submetida');
END;
$$;

REVOKE ALL ON FUNCTION public.admissao_revisar_documentos_reenviados(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_revisar_documentos_reenviados(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admissao_revisar_documentos_reenviados(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_revisar_documentos_reenviados(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_revisar_documentos_reenviados(uuid, uuid, text) TO service_role;

COMMIT;
