BEGIN;

-- ---------------------------------------------------------------------------
-- Public-school rematriculation capability alignment.
--
-- RAA remains the academic authority. Financial debt/payment is only an
-- additional gate when the school operating profile enables that capability.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_rematricula_grant_with_origin_debt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_open_count integer;
  v_matricula_origem_id uuid;
BEGIN
  IF NEW.servico_codigo = 'SERV_REMATRICULA'
     AND NEW.status = 'granted'
     AND OLD.status IS DISTINCT FROM 'granted'
     AND public.school_finance_allows_operation(NEW.escola_id, 'financial_suspension') THEN
    v_matricula_origem_id := coalesce(
      nullif(NEW.contexto->>'origem_matricula_id', '')::uuid,
      OLD.matricula_id
    );

    SELECT count(*)
      INTO v_open_count
    FROM public.mensalidades m
    WHERE m.escola_id = NEW.escola_id
      AND m.aluno_id = NEW.aluno_id
      AND m.matricula_id = v_matricula_origem_id
      AND greatest(
        coalesce(m.valor_previsto, m.valor, 0) - coalesce(m.valor_pago_total, 0),
        0
      ) > 0
      AND lower(coalesce(m.status, '')) NOT IN ('pago', 'isento', 'cancelado');

    IF v_open_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
        DETAIL = 'A matrícula de origem possui mensalidades pendentes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- rematricula_em_massa: preserve the current implementation and only change
-- the financial-suspension predicate. Fail the migration if the expected
-- contract cannot be found, rather than silently leaving a bypass.
DO $patch_bulk$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'rematricula_em_massa'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_origem_turma_id uuid, p_destino_turma_id uuid';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'DATA: rematricula_em_massa não encontrada';
  END IF;

  v_updated := replace(
    v_definition,
    'IF v_balance > 0 THEN',
    'IF public.school_finance_allows_operation(p_escola_id, ''financial_suspension'') AND v_balance > 0 THEN'
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'DATA: guard de dívida de rematricula_em_massa não encontrado';
  END IF;

  EXECUTE v_updated;
END;
$patch_bulk$;

-- finalizar_rematricula_balcao:
-- 1) debt is explicit in the RPC when applicable;
-- 2) p_pedido_id may be null only when the profile does not use student
--    payments, allowing a public/budget school to complete the academic flow.
DO $patch_balcao$
DECLARE
  v_definition text;
  v_updated text;
  v_marker text;
  v_service_block text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'finalizar_rematricula_balcao'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'DATA: finalizar_rematricula_balcao não encontrada';
  END IF;

  v_marker := '  v_decisao_origem := v_decision;';
  IF position(v_marker IN v_definition) = 0 THEN
    RAISE EXCEPTION 'DATA: marker RAA de finalizar_rematricula_balcao não encontrado';
  END IF;

  v_updated := replace(
    v_definition,
    v_marker,
    v_marker || E'\n\n' ||
    '  IF public.school_finance_allows_operation(p_escola_id, ''financial_suspension'') AND EXISTS (' || E'\n' ||
    '    SELECT 1 FROM public.mensalidades men' || E'\n' ||
    '    WHERE men.escola_id = p_escola_id' || E'\n' ||
    '      AND men.aluno_id = p_aluno_id' || E'\n' ||
    '      AND (men.matricula_id = p_matricula_origem_id OR men.ano_referencia = v_origem.ano_letivo)' || E'\n' ||
    '      AND greatest(coalesce(men.valor_previsto, men.valor, 0) - coalesce(men.valor_pago_total, 0), 0) > 0' || E'\n' ||
    '      AND lower(coalesce(men.status, '''')) NOT IN (''pago'', ''isento'', ''cancelado'')' || E'\n' ||
    '  ) THEN' || E'\n' ||
    '    RAISE EXCEPTION USING ERRCODE = ''23514'', MESSAGE = ''REMATRICULA_DEBT_REQUIRED'',' || E'\n' ||
    '      DETAIL = ''Existem saldos em aberto na matrícula de origem.'';' || E'\n' ||
    '  END IF;'
  );

  v_service_block :=
    '  UPDATE public.servico_pedidos' || E'\n' ||
    '     SET status = ''granted'', matricula_id = v_destino.id,' || E'\n' ||
    '         contexto = coalesce(contexto, ''{}''::jsonb) || jsonb_build_object(' || E'\n' ||
    '           ''matricula_destino_id'', v_destino.id,' || E'\n' ||
    '           ''ano_letivo_id'', p_ano_letivo_id,' || E'\n' ||
    '           ''destino_turma_id'', p_destino_turma_id,' || E'\n' ||
    '           ''matricula_criada'', v_criada,' || E'\n' ||
    '           ''decisao_academica'', v_decisao_origem' || E'\n' ||
    '         )' || E'\n' ||
    '   WHERE id = p_pedido_id AND escola_id = p_escola_id;' || E'\n' ||
    '  IF NOT FOUND THEN RAISE EXCEPTION ''Pedido de rematrícula não encontrado''; END IF;';

  IF position(v_service_block IN v_updated) = 0 THEN
    RAISE EXCEPTION 'DATA: atualização de servico_pedidos do balcão não encontrada';
  END IF;

  v_updated := replace(
    v_updated,
    v_service_block,
    '  IF p_pedido_id IS NOT NULL THEN' || E'\n' ||
    '    UPDATE public.servico_pedidos' || E'\n' ||
    '       SET status = ''granted'', matricula_id = v_destino.id,' || E'\n' ||
    '           contexto = coalesce(contexto, ''{}''::jsonb) || jsonb_build_object(' || E'\n' ||
    '             ''matricula_destino_id'', v_destino.id,' || E'\n' ||
    '             ''ano_letivo_id'', p_ano_letivo_id,' || E'\n' ||
    '             ''destino_turma_id'', p_destino_turma_id,' || E'\n' ||
    '             ''matricula_criada'', v_criada,' || E'\n' ||
    '             ''decisao_academica'', v_decisao_origem' || E'\n' ||
    '           )' || E'\n' ||
    '     WHERE id = p_pedido_id AND escola_id = p_escola_id;' || E'\n' ||
    '    IF NOT FOUND THEN RAISE EXCEPTION ''Pedido de rematrícula não encontrado''; END IF;' || E'\n' ||
    '  ELSIF public.school_finance_allows_operation(p_escola_id, ''student_payment'') THEN' || E'\n' ||
    '    RAISE EXCEPTION ''DATA: pedido de rematrícula é obrigatório para escola com financeiro transacional'';' || E'\n' ||
    '  END IF;'
  );

  EXECUTE v_updated;
END;
$patch_balcao$;

-- aluno_iniciar_rematricula:
-- For non-transactional schools the portal creates the academic renewal
-- candidatura and stops before service pricing/payment intent creation.
DO $patch_portal$
DECLARE
  v_definition text;
  v_updated text;
  v_service_marker text := '  SELECT * INTO v_servico_rematricula';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'aluno_iniciar_rematricula'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_matricula_id uuid, p_servicos_ids uuid[]';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'DATA: aluno_iniciar_rematricula não encontrada';
  END IF;

  v_updated := replace(
    v_definition,
    '  IF EXISTS (' || E'\n' ||
    '    SELECT 1' || E'\n' ||
    '    FROM public.mensalidades men' || E'\n' ||
    '    WHERE men.escola_id = v_escola_id',
    '  IF public.school_finance_allows_operation(v_escola_id, ''financial_suspension'') AND EXISTS (' || E'\n' ||
    '    SELECT 1' || E'\n' ||
    '    FROM public.mensalidades men' || E'\n' ||
    '    WHERE men.escola_id = v_escola_id'
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'DATA: guard de dívida do portal de rematrícula não encontrado';
  END IF;

  IF position(v_service_marker IN v_updated) = 0 THEN
    RAISE EXCEPTION 'DATA: marker de monetização do portal de rematrícula não encontrado';
  END IF;

  v_updated := replace(
    v_updated,
    v_service_marker,
    '  IF NOT public.school_finance_allows_operation(v_escola_id, ''student_payment'') THEN' || E'\n' ||
    '    SELECT c.id INTO v_candidatura_id' || E'\n' ||
    '    FROM public.candidaturas c' || E'\n' ||
    '    WHERE c.escola_id = v_escola_id' || E'\n' ||
    '      AND c.aluno_id = v_mat.aluno_id' || E'\n' ||
    '      AND c.ano_letivo = v_ano_destino' || E'\n' ||
    '      AND c.source = ''PORTAL_ALUNO_REMATRICULA''' || E'\n' ||
    '      AND c.status <> ''rejeitada''' || E'\n' ||
    '    ORDER BY c.created_at DESC' || E'\n' ||
    '    LIMIT 1;' || E'\n\n' ||
    '    IF v_candidatura_id IS NULL THEN' || E'\n' ||
    '      INSERT INTO public.candidaturas (' || E'\n' ||
    '        escola_id, aluno_id, curso_id, ano_letivo, status, nome_candidato, source, dados_candidato' || E'\n' ||
    '      ) VALUES (' || E'\n' ||
    '        v_escola_id, v_mat.aluno_id, v_curso_destino_id, v_ano_destino, ''submetida'', v_aluno.nome,' || E'\n' ||
    '        ''PORTAL_ALUNO_REMATRICULA'',' || E'\n' ||
    '        jsonb_build_object(' || E'\n' ||
    '          ''nome_completo'', v_aluno.nome,' || E'\n' ||
    '          ''bi_numero'', v_aluno.bi_numero,' || E'\n' ||
    '          ''telefone'', v_aluno.telefone,' || E'\n' ||
    '          ''responsavel_nome'', v_aluno.responsavel_nome,' || E'\n' ||
    '          ''responsavel_contato'', v_aluno.responsavel_contato,' || E'\n' ||
    '          ''tipo'', ''rematricula'',' || E'\n' ||
    '          ''matricula_origem_id'', v_mat.id,' || E'\n' ||
    '          ''curso_destino_id'', v_curso_destino_id,' || E'\n' ||
    '          ''classe_destino_id'', v_classe_destino_id,' || E'\n' ||
    '          ''classe_destino_numero'', v_classe_destino_numero,' || E'\n' ||
    '          ''raa_decision'', v_raa->>''decision'',' || E'\n' ||
    '          ''raa_destino'', v_raa->>''destino'',' || E'\n' ||
    '          ''raa_disciplina_ids_pendentes'', coalesce(v_raa->''disciplina_ids_pendentes'', ''[]''::jsonb),' || E'\n' ||
    '          ''payment_required'', false' || E'\n' ||
    '        )' || E'\n' ||
    '      ) RETURNING id INTO v_candidatura_id;' || E'\n' ||
    '    END IF;' || E'\n\n' ||
    '    RETURN jsonb_build_object(' || E'\n' ||
    '      ''ok'', true,' || E'\n' ||
    '      ''candidatura_id'', v_candidatura_id,' || E'\n' ||
    '      ''pedido_id'', NULL,' || E'\n' ||
    '      ''pagamento_intent_id'', NULL,' || E'\n' ||
    '      ''next_ano'', v_ano_destino,' || E'\n' ||
    '      ''status'', ''submitted'',' || E'\n' ||
    '      ''payment_required'', false,' || E'\n' ||
    '      ''curso_destino_id'', v_curso_destino_id,' || E'\n' ||
    '      ''classe_destino_id'', v_classe_destino_id,' || E'\n' ||
    '      ''classe_destino_numero'', v_classe_destino_numero,' || E'\n' ||
    '      ''raa_decision'', v_raa->>''decision'',' || E'\n' ||
    '      ''raa_destino'', v_raa->>''destino'',' || E'\n' ||
    '      ''raa_disciplina_ids_pendentes'', coalesce(v_raa->''disciplina_ids_pendentes'', ''[]''::jsonb),' || E'\n' ||
    '      ''valor_total'', 0' || E'\n' ||
    '    );' || E'\n' ||
    '  END IF;' || E'\n\n' ||
    v_service_marker
  );

  EXECUTE v_updated;
END;
$patch_portal$;

COMMIT;
