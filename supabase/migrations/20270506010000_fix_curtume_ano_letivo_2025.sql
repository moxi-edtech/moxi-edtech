-- Corrige a sessao academica criada com ano letivo incorreto para a escola:
-- complexo-escolar-privado-advetista-de-curtume.
--
-- Contexto:
-- - A sessao ativa foi criada como 2026/2027.
-- - O calendario oficial correto e 2025/2026.
-- - Esta migration retifica a sessao existente, preservando o ano_letivo_id
--   para manter curriculos, turmas e periodos na mesma identidade operacional.

DO $$
DECLARE
  v_escola_id constant uuid := '3744879f-2e19-4671-8995-78604302d8c5';
  v_ano_id constant uuid := 'a587cee1-1985-47ab-8986-2eefb11b0c61';
  v_expected_slug constant text := 'complexo-escolar-privado-advetista-de-curtume';

  v_escola record;
  v_ano record;
  v_before jsonb;
  v_after jsonb;
  v_rows bigint;

  v_turmas bigint;
  v_matriculas bigint;
  v_candidaturas bigint;
  v_financeiro_tabelas bigint;
  v_financeiro_contratos bigint;
  v_avaliacoes bigint;
  v_mensalidades bigint;
BEGIN
  -- Bloqueio curto para impedir que novos registros sejam criados com o ano
  -- errado enquanto a retificacao esta em curso.
  LOCK TABLE
    public.anos_letivos,
    public.periodos_letivos,
    public.turmas,
    public.matriculas,
    public.candidaturas,
    public.financeiro_tabelas,
    public.financeiro_contratos,
    public.avaliacoes,
    public.mensalidades
  IN SHARE ROW EXCLUSIVE MODE;

  SELECT id, nome, slug, status
  INTO v_escola
  FROM public.escolas
  WHERE id = v_escola_id
  FOR UPDATE;

  IF v_escola.id IS NULL THEN
    RAISE EXCEPTION 'Escola alvo nao encontrada: %', v_escola_id;
  END IF;

  IF lower(coalesce(v_escola.slug, '')) <> v_expected_slug THEN
    RAISE EXCEPTION 'Slug inesperado para escola %. Esperado %, recebido %',
      v_escola_id, v_expected_slug, v_escola.slug;
  END IF;

  SELECT id, escola_id, ano, data_inicio, data_fim, ativo
  INTO v_ano
  FROM public.anos_letivos
  WHERE id = v_ano_id
    AND escola_id = v_escola_id
  FOR UPDATE;

  IF v_ano.id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo alvo nao encontrado: %', v_ano_id;
  END IF;

  IF v_ano.ano = 2025 THEN
    RAISE NOTICE 'Ano letivo % ja esta em 2025; migration sem alteracoes.', v_ano_id;
    RETURN;
  END IF;

  IF v_ano.ano <> 2026 OR v_ano.ativo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Estado inicial inesperado em anos_letivos: id %, ano %, ativo %',
      v_ano.id, v_ano.ano, v_ano.ativo;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.anos_letivos
    WHERE escola_id = v_escola_id
      AND ano = 2025
      AND id <> v_ano_id
  ) THEN
    RAISE EXCEPTION 'Ja existe outra sessao 2025 para a escola %, abortando.', v_escola_id;
  END IF;

  IF (
    SELECT count(*)
    FROM public.anos_letivos
    WHERE escola_id = v_escola_id
  ) <> 1 THEN
    RAISE EXCEPTION 'A escola % nao possui exatamente uma sessao academica; revisar manualmente.', v_escola_id;
  END IF;

  IF (
    SELECT count(*)
    FROM public.periodos_letivos
    WHERE escola_id = v_escola_id
      AND ano_letivo_id = v_ano_id
      AND numero IN (1, 2, 3)
  ) <> 3 THEN
    RAISE EXCEPTION 'Periodos letivos esperados nao encontrados para ano_letivo_id %.', v_ano_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mensalidades
    WHERE escola_id = v_escola_id
      AND ano_letivo = '2026'
      AND fiscal_documento_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Existem mensalidades 2026 com documento fiscal vinculado; ajuste manual obrigatorio.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mensalidades
    WHERE escola_id = v_escola_id
      AND ano_letivo = '2026'
      AND (
        ano_referencia IS NULL
        OR mes_referencia IS NULL
        OR data_vencimento IS NULL
        OR NOT (
          (ano_referencia = 2026 AND mes_referencia BETWEEN 9 AND 12)
          OR (ano_referencia = 2027 AND mes_referencia BETWEEN 1 AND 7)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Existem mensalidades 2026 fora da janela esperada 2026/09..2027/07.';
  END IF;

  SELECT count(*) INTO v_turmas
  FROM public.turmas
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_matriculas
  FROM public.matriculas
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_candidaturas
  FROM public.candidaturas
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_financeiro_tabelas
  FROM public.financeiro_tabelas
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_financeiro_contratos
  FROM public.financeiro_contratos
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_avaliacoes
  FROM public.avaliacoes
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  SELECT count(*) INTO v_mensalidades
  FROM public.mensalidades
  WHERE escola_id = v_escola_id
    AND ano_letivo = '2026';

  v_before := jsonb_build_object(
    'escola', jsonb_build_object(
      'id', v_escola.id,
      'nome', v_escola.nome,
      'slug', v_escola.slug,
      'status', v_escola.status
    ),
    'ano_letivo', to_jsonb(v_ano),
    'periodos_letivos', (
      SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.numero), '[]'::jsonb)
      FROM public.periodos_letivos p
      WHERE p.escola_id = v_escola_id
        AND p.ano_letivo_id = v_ano_id
    ),
    'counts_2026', jsonb_build_object(
      'turmas', v_turmas,
      'matriculas', v_matriculas,
      'candidaturas', v_candidaturas,
      'financeiro_tabelas', v_financeiro_tabelas,
      'financeiro_contratos', v_financeiro_contratos,
      'avaliacoes', v_avaliacoes,
      'mensalidades', v_mensalidades
    )
  );

  UPDATE public.anos_letivos
  SET ano = 2025,
      data_inicio = DATE '2025-09-01',
      data_fim = DATE '2026-07-31',
      updated_at = now()
  WHERE id = v_ano_id
    AND escola_id = v_escola_id
    AND ano = 2026
    AND ativo = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Falha ao atualizar anos_letivos: esperado 1, obtido %.', v_rows;
  END IF;

  UPDATE public.periodos_letivos
  SET data_inicio = CASE numero
      WHEN 1 THEN DATE '2025-09-02'
      WHEN 2 THEN DATE '2026-01-05'
      WHEN 3 THEN DATE '2026-04-13'
    END,
    data_fim = CASE numero
      WHEN 1 THEN DATE '2025-12-31'
      WHEN 2 THEN DATE '2026-04-10'
      WHEN 3 THEN DATE '2026-07-31'
    END,
    updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo_id = v_ano_id
    AND numero IN (1, 2, 3);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 3 THEN
    RAISE EXCEPTION 'Falha ao atualizar periodos_letivos: esperado 3, obtido %.', v_rows;
  END IF;

  UPDATE public.turmas
  SET ano_letivo = 2025,
      updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_turmas THEN
    RAISE EXCEPTION 'Falha ao atualizar turmas: esperado %, obtido %.', v_turmas, v_rows;
  END IF;

  UPDATE public.matriculas
  SET ano_letivo = 2025,
      updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_matriculas THEN
    RAISE EXCEPTION 'Falha ao atualizar matriculas: esperado %, obtido %.', v_matriculas, v_rows;
  END IF;

  UPDATE public.candidaturas
  SET ano_letivo = 2025,
      updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_candidaturas THEN
    RAISE EXCEPTION 'Falha ao atualizar candidaturas: esperado %, obtido %.', v_candidaturas, v_rows;
  END IF;

  UPDATE public.financeiro_tabelas
  SET ano_letivo = 2025,
      updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_financeiro_tabelas THEN
    RAISE EXCEPTION 'Falha ao atualizar financeiro_tabelas: esperado %, obtido %.',
      v_financeiro_tabelas, v_rows;
  END IF;

  UPDATE public.financeiro_contratos
  SET ano_letivo = 2025
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_financeiro_contratos THEN
    RAISE EXCEPTION 'Falha ao atualizar financeiro_contratos: esperado %, obtido %.',
      v_financeiro_contratos, v_rows;
  END IF;

  UPDATE public.avaliacoes
  SET ano_letivo = 2025
  WHERE escola_id = v_escola_id
    AND ano_letivo = 2026;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_avaliacoes THEN
    RAISE EXCEPTION 'Falha ao atualizar avaliacoes: esperado %, obtido %.', v_avaliacoes, v_rows;
  END IF;

  UPDATE public.mensalidades
  SET ano_letivo = '2025',
      ano_referencia = ano_referencia - 1,
      data_vencimento = (data_vencimento - interval '1 year')::date,
      updated_at = now()
  WHERE escola_id = v_escola_id
    AND ano_letivo = '2026'
    AND (
      (ano_referencia = 2026 AND mes_referencia BETWEEN 9 AND 12)
      OR (ano_referencia = 2027 AND mes_referencia BETWEEN 1 AND 7)
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_mensalidades THEN
    RAISE EXCEPTION 'Falha ao atualizar mensalidades: esperado %, obtido %.', v_mensalidades, v_rows;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.turmas WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.matriculas WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.candidaturas WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.financeiro_tabelas WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.financeiro_contratos WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.avaliacoes WHERE escola_id = v_escola_id AND ano_letivo = 2026
    UNION ALL
    SELECT 1 FROM public.mensalidades WHERE escola_id = v_escola_id AND ano_letivo = '2026'
  ) THEN
    RAISE EXCEPTION 'Validacao final falhou: ainda existem referencias ao ano letivo 2026.';
  END IF;

  SELECT to_jsonb(al)
  INTO v_after
  FROM public.anos_letivos al
  WHERE al.id = v_ano_id
    AND al.escola_id = v_escola_id;

  INSERT INTO public.escola_auditoria (escola_id, acao, mensagem, dados)
  VALUES (
    v_escola_id,
    'ano_letivo_retificado',
    'Ano letivo operacional retificado de 2026/2027 para 2025/2026',
    jsonb_build_object(
      'migration', '20270506010000_fix_curtume_ano_letivo_2025',
      'before', v_before,
      'after', v_after,
      'calendario_oficial', jsonb_build_object(
        'abertura_oficial', '2025-09-01',
        'inicio_atividades_lectivas', '2025-09-02',
        'termino_ano_letivo', '2026-07-31',
        'trimestres', jsonb_build_array(
          jsonb_build_object('numero', 1, 'data_inicio', '2025-09-02', 'data_fim', '2025-12-31'),
          jsonb_build_object('numero', 2, 'data_inicio', '2026-01-05', 'data_fim', '2026-04-10'),
          jsonb_build_object('numero', 3, 'data_inicio', '2026-04-13', 'data_fim', '2026-07-31')
        )
      )
    )
  );

  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    action,
    entity,
    entity_id,
    actor_role,
    details,
    before,
    after
  )
  VALUES (
    v_escola_id,
    'ops',
    'ano_letivo_retificado',
    'anos_letivos',
    v_ano_id::text,
    'migration',
    jsonb_build_object(
      'migration', '20270506010000_fix_curtume_ano_letivo_2025',
      'reason', 'correcao operacional de ano letivo criado como 2026/2027',
      'counts_migrated', v_before->'counts_2026'
    ),
    v_before,
    v_after
  );

  RAISE NOTICE 'Ano letivo Curtume retificado: turmas %, matriculas %, candidaturas %, mensalidades %.',
    v_turmas, v_matriculas, v_candidaturas, v_mensalidades;
END $$;
