-- Rematrícula do portal do aluno: uma única intenção de pagamento com todos os itens.
CREATE OR REPLACE FUNCTION public.aluno_iniciar_rematricula(
  p_matricula_id uuid,
  p_servicos_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_mat record;
  v_aluno record;
  v_ano_destino integer;
  v_servico_rematricula record;
  v_candidatura_id uuid;
  v_pedido_id uuid;
  v_intent_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12,2) := 0;
  v_extra_count integer := 0;
  v_item record;
BEGIN
  IF v_uid IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: não autenticado';
  END IF;

  SELECT m.id, m.escola_id, m.aluno_id, m.ano_letivo, m.turma_id
  INTO v_mat
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = v_escola_id
    AND m.status IN ('ativo', 'ativa', 'active', 'transferido')
  FOR UPDATE;

  IF v_mat.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula atual não encontrada';
  END IF;

  SELECT a.nome, a.bi_numero, a.telefone, a.responsavel_nome, a.responsavel_contato
  INTO v_aluno
  FROM public.alunos a
  WHERE a.id = v_mat.aluno_id
    AND a.escola_id = v_escola_id
    AND (a.profile_id = v_uid OR a.usuario_auth_id = v_uid);

  IF v_aluno.nome IS NULL THEN
    RAISE EXCEPTION 'AUTH: aluno não autorizado';
  END IF;

  -- A janela aberta pela escola é a fonte única do destino desta operação.
  SELECT r.ano_letivo
  INTO v_ano_destino
  FROM public.rematricula_janelas r
  WHERE r.escola_id = v_escola_id
    AND r.ativa = true
    AND r.ano_letivo > v_mat.ano_letivo
    AND r.data_inicio <= now()
    AND r.data_fim >= now()
  ORDER BY r.ano_letivo ASC, r.data_inicio DESC
  LIMIT 1;

  IF v_ano_destino IS NULL THEN
    RAISE EXCEPTION 'DATA: janela de rematrícula não está aberta';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mensalidades men
    WHERE men.escola_id = v_escola_id
      AND men.aluno_id = v_mat.aluno_id
      AND men.status IN ('pendente', 'atrasado')
  ) THEN
    RAISE EXCEPTION 'FINANCEIRO: possui pendências financeiras';
  END IF;

  SELECT * INTO v_servico_rematricula
  FROM public.servicos_escola
  WHERE escola_id = v_escola_id
    AND codigo = 'SERV_REMATRICULA'
    AND ativo = true;

  IF v_servico_rematricula.id IS NULL OR COALESCE(v_servico_rematricula.valor_base, 0) <= 0 THEN
    RAISE EXCEPTION 'DATA: serviço de rematrícula não configurado';
  END IF;

  v_items := jsonb_build_array(jsonb_build_object(
    'id', v_servico_rematricula.id,
    'codigo', v_servico_rematricula.codigo,
    'nome', v_servico_rematricula.nome,
    'descricao', v_servico_rematricula.descricao,
    'valor', v_servico_rematricula.valor_base,
    'quantidade', 1,
    'tipo', 'rematricula'
  ));
  v_total := v_servico_rematricula.valor_base;

  IF COALESCE(array_length(p_servicos_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_extra_count
    FROM public.servicos_escola s
    WHERE s.escola_id = v_escola_id
      AND s.id = ANY(p_servicos_ids)
      AND s.codigo <> 'SERV_REMATRICULA'
      AND s.ativo = true
      AND s.valor_base > 0;

    IF v_extra_count <> (SELECT count(*) FROM unnest(p_servicos_ids)) THEN
      RAISE EXCEPTION 'DATA: um dos serviços selecionados não está disponível';
    END IF;

    FOR v_item IN
      SELECT s.id, s.codigo, s.nome, s.descricao, s.valor_base
      FROM public.servicos_escola s
      WHERE s.escola_id = v_escola_id
        AND s.id = ANY(p_servicos_ids)
      ORDER BY s.nome ASC, s.id ASC
    LOOP
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'id', v_item.id,
        'codigo', v_item.codigo,
        'nome', v_item.nome,
        'descricao', v_item.descricao,
        'valor', v_item.valor_base,
        'quantidade', 1,
        'tipo', 'servico'
      ));
      v_total := v_total + v_item.valor_base;
    END LOOP;
  END IF;

  SELECT c.id INTO v_candidatura_id
  FROM public.candidaturas c
  WHERE c.escola_id = v_escola_id
    AND c.aluno_id = v_mat.aluno_id
    AND c.ano_letivo = v_ano_destino
    AND c.source = 'PORTAL_ALUNO_REMATRICULA'
    AND c.status <> 'rejeitada'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_candidatura_id IS NULL THEN
    INSERT INTO public.candidaturas (
      escola_id, aluno_id, curso_id, ano_letivo, status, nome_candidato, source, dados_candidato
    )
    SELECT
      v_escola_id, v_mat.aluno_id, t.curso_id, v_ano_destino, 'submetida', v_aluno.nome,
      'PORTAL_ALUNO_REMATRICULA',
      jsonb_build_object(
        'nome_completo', v_aluno.nome,
        'bi_numero', v_aluno.bi_numero,
        'telefone', v_aluno.telefone,
        'responsavel_nome', v_aluno.responsavel_nome,
        'responsavel_contato', v_aluno.responsavel_contato,
        'tipo', 'rematricula',
        'matricula_origem_id', v_mat.id,
        'itens_pagamento', v_items,
        'valor_total', v_total
      )
    FROM public.turmas t
    WHERE t.id = v_mat.turma_id
      AND t.escola_id = v_escola_id
    RETURNING id INTO v_candidatura_id;

    IF v_candidatura_id IS NULL THEN
      RAISE EXCEPTION 'DATA: turma de origem não encontrada para a rematrícula';
    END IF;
  END IF;

  SELECT sp.id INTO v_pedido_id
  FROM public.servico_pedidos sp
  WHERE sp.escola_id = v_escola_id
    AND sp.aluno_id = v_mat.aluno_id
    AND sp.servico_codigo = 'SERV_REMATRICULA'
    AND sp.contexto->>'candidatura_id' = v_candidatura_id::text
    AND sp.status IN ('pending_payment', 'granted')
  ORDER BY sp.created_at DESC
  LIMIT 1;

  IF v_pedido_id IS NOT NULL THEN
    SELECT pi.id INTO v_intent_id
    FROM public.pagamento_intents pi
    WHERE pi.servico_pedido_id = v_pedido_id
      AND pi.status NOT IN ('failed', 'rejected', 'cancelled', 'canceled')
    ORDER BY pi.created_at DESC
    LIMIT 1;
  END IF;

  IF v_pedido_id IS NULL THEN
    INSERT INTO public.servico_pedidos (
      escola_id, aluno_id, matricula_id, servico_escola_id, status,
      servico_codigo, servico_nome, valor_cobrado, contexto, created_by
    ) VALUES (
      v_escola_id, v_mat.aluno_id, v_mat.id, v_servico_rematricula.id, 'pending_payment',
      v_servico_rematricula.codigo, v_servico_rematricula.nome, v_total,
      jsonb_build_object(
        'origem', 'portal_rematricula',
        'candidatura_id', v_candidatura_id,
        'ano_letivo', v_ano_destino,
        'itens_pagamento', v_items,
        'valor_total', v_total
      ), v_uid
    ) RETURNING id INTO v_pedido_id;

  END IF;

  IF v_intent_id IS NULL THEN
    INSERT INTO public.pagamento_intents (
      escola_id, aluno_id, servico_pedido_id, amount, status, method, reference, meta, created_by
    ) VALUES (
      v_escola_id, v_mat.aluno_id, v_pedido_id, v_total, 'draft', 'transfer',
      'REMAT-' || v_ano_destino || '-' || upper(substr(v_pedido_id::text, 1, 8)),
      jsonb_build_object(
        'origem', 'portal_rematricula',
        'candidatura_id', v_candidatura_id,
        'matricula_id', v_mat.id,
        'ano_letivo', v_ano_destino,
        'itens_pagamento', v_items,
        'valor_total', v_total
      ), v_uid
    ) RETURNING id INTO v_intent_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'candidatura_id', v_candidatura_id,
    'pedido_id', v_pedido_id,
    'pagamento_intent_id', v_intent_id,
    'next_ano', v_ano_destino,
    'status', CASE WHEN EXISTS (SELECT 1 FROM public.pagamento_intents WHERE id = v_intent_id AND status = 'settled') THEN 'settled' ELSE 'pending_payment' END,
    'itens_pagamento', v_items,
    'valor_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) TO authenticated;

-- Quando a secretaria liquida a intenção, gerar o recibo consolidado da rematrícula.
CREATE OR REPLACE FUNCTION public.emitir_recibo_intent_rematricula(p_pagamento_intent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent record;
  v_pedido record;
  v_aluno record;
  v_turma record;
  v_doc record;
  v_snapshot jsonb;
  v_hash text;
  v_numero bigint;
  v_created_by uuid;
BEGIN
  SELECT * INTO v_intent
  FROM public.pagamento_intents
  WHERE id = p_pagamento_intent_id
    AND status = 'settled'
    AND meta->>'origem' = 'portal_rematricula';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Intenção de rematrícula não encontrada ou ainda não liquidada');
  END IF;

  SELECT id, contexto, matricula_id INTO v_pedido
  FROM public.servico_pedidos
  WHERE id = v_intent.servico_pedido_id;

  SELECT nome, bi_numero INTO v_aluno
  FROM public.alunos
  WHERE id = v_intent.aluno_id;

  SELECT t.nome AS turma_nome, cl.nome AS classe_nome, c.nome AS curso_nome
  INTO v_turma
  FROM public.matriculas m
  JOIN public.turmas t ON t.id = m.turma_id
  LEFT JOIN public.classes cl ON cl.id = t.classe_id
  LEFT JOIN public.cursos c ON c.id = t.curso_id
  WHERE m.aluno_id = v_intent.aluno_id
    AND m.escola_id = v_intent.escola_id
  ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC
  LIMIT 1;

  SELECT id, public_id, created_at INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo'
    AND escola_id = v_intent.escola_id
    AND dados_snapshot->>'pagamento_intent_id' = p_pagamento_intent_id::text
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
  END IF;

  v_hash := encode(sha256((random()::text || p_pagamento_intent_id::text)::bytea), 'hex');
  SELECT public.next_documento_numero(v_intent.escola_id) INTO v_numero;
  v_created_by := COALESCE(public.safe_auth_uid(), v_intent.created_by);
  v_snapshot := jsonb_build_object(
    'tipo_comprovativo', 'confirmacao',
    'pagamento_intent_id', v_intent.id,
    'aluno_id', v_intent.aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'turma_nome', v_turma.turma_nome,
    'classe_nome', v_turma.classe_nome,
    'curso_nome', v_turma.curso_nome,
    'referencia', v_intent.reference,
    'itens_pagamento', COALESCE(v_intent.meta->'itens_pagamento', v_pedido.contexto->'itens_pagamento', '[]'::jsonb),
    'valor_pago', v_intent.amount,
    'data_pagamento', COALESCE(v_intent.settled_at, now()),
    'metodo', v_intent.method,
    'numero_sequencial', v_numero,
    'hash_validacao', v_hash
  );

  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_intent.escola_id, v_intent.aluno_id, v_numero, 'recibo', v_snapshot, v_created_by, v_hash
  )
  RETURNING id, public_id, created_at INTO v_doc;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_recibo_intent_rematricula(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emitir_recibo_intent_rematricula(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.emitir_recibo_intent_rematricula(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.emitir_recibo_intent_rematricula_after_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'settled'
     AND OLD.status IS DISTINCT FROM 'settled'
     AND NEW.meta->>'origem' = 'portal_rematricula' THEN
    PERFORM public.emitir_recibo_intent_rematricula(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emitir_recibo_intent_rematricula ON public.pagamento_intents;
CREATE TRIGGER trg_emitir_recibo_intent_rematricula
AFTER UPDATE OF status ON public.pagamento_intents
FOR EACH ROW
EXECUTE FUNCTION public.emitir_recibo_intent_rematricula_after_settled();
