-- Ensure admission drafts use the school's active academic year, not the civil year.
-- Existing inconsistent drafts are realigned with their selected preferred class group.

CREATE OR REPLACE FUNCTION public.admissao_upsert_draft(
  p_escola_id uuid,
  p_candidatura_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'walkin'::text,
  p_dados_candidato jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_id uuid;
  v_tenant_escola_id uuid := public.current_tenant_escola_id();

  v_nome text := nullif(trim(p_dados_candidato->>'nome_candidato'), '');
  v_turno text := nullif(trim(p_dados_candidato->>'turno'), '');

  v_curso_id uuid := null;
  v_classe_id uuid := null;
  v_turma_pref_id uuid := null;

  v_input_ano_letivo int := null;
  v_turma_ano_letivo int := null;
  v_active_ano_letivo int := null;
  v_resolved_ano_letivo int := null;

  v_desconto numeric := coalesce(nullif(p_dados_candidato->>'percentagem_desconto', '')::numeric, 0);
  v_motivo_desconto text := nullif(trim(p_dados_candidato->>'motivo_desconto'), '');
  v_clean jsonb;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant_escola_id THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  BEGIN
    IF nullif(p_dados_candidato->>'curso_id', '') IS NOT NULL THEN
      v_curso_id := (p_dados_candidato->>'curso_id')::uuid;
    END IF;
    IF nullif(p_dados_candidato->>'classe_id', '') IS NOT NULL THEN
      v_classe_id := (p_dados_candidato->>'classe_id')::uuid;
    END IF;
    IF nullif(p_dados_candidato->>'turma_preferencial_id', '') IS NOT NULL THEN
      v_turma_pref_id := (p_dados_candidato->>'turma_preferencial_id')::uuid;
    END IF;
    IF nullif(p_dados_candidato->>'ano_letivo', '') IS NOT NULL THEN
      v_input_ano_letivo := (p_dados_candidato->>'ano_letivo')::int;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Payload inválido: UUID ou ano letivo malformado';
  END;

  IF v_turma_pref_id IS NOT NULL THEN
    SELECT t.ano_letivo
    INTO v_turma_ano_letivo
    FROM public.turmas t
    WHERE t.id = v_turma_pref_id
      AND t.escola_id = p_escola_id;

    IF v_turma_ano_letivo IS NULL THEN
      RAISE EXCEPTION 'Turma preferencial inválida para esta escola';
    END IF;
  END IF;

  SELECT al.ano
  INTO v_active_ano_letivo
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ativo IS TRUE
  ORDER BY al.ano DESC
  LIMIT 1;

  v_resolved_ano_letivo := coalesce(
    v_turma_ano_letivo,
    v_input_ano_letivo,
    v_active_ano_letivo,
    extract(year from current_date)::int
  );

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'nome_candidato', v_nome,
    'bi_numero', nullif(trim(p_dados_candidato->>'bi_numero'), ''),
    'tipo_documento', nullif(trim(p_dados_candidato->>'tipo_documento'), ''),
    'numero_documento', nullif(trim(p_dados_candidato->>'numero_documento'), ''),
    'telefone', nullif(trim(p_dados_candidato->>'telefone'), ''),
    'email', nullif(lower(trim(p_dados_candidato->>'email')), ''),
    'curso_id', v_curso_id,
    'classe_id', v_classe_id,
    'turma_preferencial_id', v_turma_pref_id,
    'ano_letivo', v_resolved_ano_letivo,
    'turno', v_turno,
    'data_nascimento', nullif(trim(p_dados_candidato->>'data_nascimento'), ''),
    'sexo', nullif(trim(p_dados_candidato->>'sexo'), ''),
    'nif', nullif(trim(p_dados_candidato->>'nif'), ''),
    'endereco', nullif(trim(p_dados_candidato->>'endereco'), ''),
    'naturalidade', nullif(trim(p_dados_candidato->>'naturalidade'), ''),
    'provincia', nullif(trim(p_dados_candidato->>'provincia'), ''),
    'pai_nome', nullif(trim(p_dados_candidato->>'pai_nome'), ''),
    'mae_nome', nullif(trim(p_dados_candidato->>'mae_nome'), ''),
    'encarregado_relacao', nullif(trim(p_dados_candidato->>'encarregado_relacao'), ''),
    'responsavel_nome', nullif(trim(p_dados_candidato->>'responsavel_nome'), ''),
    'responsavel_contato', nullif(trim(p_dados_candidato->>'responsavel_contato'), ''),
    'encarregado_email', nullif(lower(trim(p_dados_candidato->>'encarregado_email')), ''),
    'responsavel_financeiro_nome', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nome'), ''),
    'responsavel_financeiro_nif', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nif'), ''),
    'percentagem_desconto', v_desconto,
    'motivo_desconto', v_motivo_desconto,
    'mesmo_que_encarregado',
      CASE
        WHEN p_dados_candidato ? 'mesmo_que_encarregado'
          THEN (p_dados_candidato->>'mesmo_que_encarregado')::boolean
        ELSE null
      END,
    'documentos',
      CASE
        WHEN jsonb_typeof(p_dados_candidato->'documentos') = 'object'
          THEN p_dados_candidato->'documentos'
        ELSE null
      END,
    'campos_extras',
      CASE
        WHEN jsonb_typeof(p_dados_candidato->'campos_extras') = 'object'
          THEN p_dados_candidato->'campos_extras'
        ELSE null
      END
  ));

  IF p_candidatura_id IS NULL THEN
    INSERT INTO public.candidaturas (
      escola_id,
      status,
      ano_letivo,
      source,
      nome_candidato,
      curso_id,
      classe_id,
      turma_preferencial_id,
      turno,
      percentagem_desconto,
      motivo_desconto,
      dados_candidato
    ) VALUES (
      p_escola_id,
      'rascunho',
      v_resolved_ano_letivo,
      coalesce(nullif(p_source, ''), 'walkin'),
      v_nome,
      v_curso_id,
      v_classe_id,
      v_turma_pref_id,
      v_turno,
      v_desconto,
      v_motivo_desconto,
      coalesce(v_clean, '{}'::jsonb)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.candidaturas c
    SET
      source = coalesce(nullif(p_source, ''), c.source),
      nome_candidato = coalesce(v_nome, c.nome_candidato),
      curso_id = coalesce(v_curso_id, c.curso_id),
      classe_id = coalesce(v_classe_id, c.classe_id),
      turma_preferencial_id = coalesce(v_turma_pref_id, c.turma_preferencial_id),
      ano_letivo = CASE
        WHEN v_turma_pref_id IS NOT NULL OR v_input_ano_letivo IS NOT NULL THEN v_resolved_ano_letivo
        ELSE c.ano_letivo
      END,
      turno = coalesce(v_turno, c.turno),
      percentagem_desconto = v_desconto,
      motivo_desconto = v_motivo_desconto,
      dados_candidato = coalesce(c.dados_candidato, '{}'::jsonb) || coalesce(v_clean, '{}'::jsonb)
    WHERE c.id = p_candidatura_id
      AND c.escola_id = v_tenant_escola_id
    RETURNING c.id INTO v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

UPDATE public.candidaturas c
SET
  ano_letivo = t.ano_letivo,
  dados_candidato = jsonb_set(
    coalesce(c.dados_candidato, '{}'::jsonb),
    '{ano_letivo}',
    to_jsonb(t.ano_letivo),
    true
  ),
  updated_at = now()
FROM public.turmas t
WHERE c.turma_preferencial_id = t.id
  AND c.ano_letivo IS DISTINCT FROM t.ano_letivo
  AND c.status NOT IN ('matriculado', 'rejeitada');
