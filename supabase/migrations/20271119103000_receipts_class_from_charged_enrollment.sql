-- Recibo académico: a classe tem de vir da matrícula associada à cobrança.
-- Protege os dois emissores operacionais. CREATE OR REPLACE preserva GRANTs,
-- os guards existentes e a política de idempotência/numeração.
-- Não atualiza documentos_emitidos nem reescreve snapshots de recibos emitidos.
-- Caso a cobrança e a matrícula discordem, a classe permanece NULL em vez
-- de atribuir a turma de outro ano/tenant.
CREATE OR REPLACE FUNCTION public._emitir_recibo_operacional_internal(p_mensalidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_m record;
  v_aluno record;
  v_turma record;
  v_doc record;
  v_hash_validacao text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  -- Selecionar dados da mensalidade
  SELECT * INTO v_m FROM public.mensalidades WHERE id = p_mensalidade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matricula_reclassificacoes mr
    WHERE mr.escola_id = v_m.escola_id
      AND mr.aluno_id = v_m.aluno_id
      AND mr.status = 'aguardando_destino'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'MATRICULA_AGUARDANDO_RECLASSIFICACAO',
      'mensagem', 'Aluno aguarda definição de destino académico'
    );
  END IF;

  -- Verificar permissão
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  -- Verificar status de pagamento
  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  -- Verificar se já existe recibo
  SELECT id, public_id, created_at INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo' AND mensalidade_id = p_mensalidade_id LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
  END IF;

  -- Buscar dados do Aluno
  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = v_m.aluno_id;

  -- Buscar turma pela matrícula da mensalidade, nunca por histórico de outro ano
  SELECT t.nome as turma_nome, t.turno, cl.nome as classe_nome, c.nome as curso_nome
  INTO v_turma
  FROM public.matriculas mt
  JOIN public.turmas t
    ON t.id = mt.turma_id AND t.escola_id = v_m.escola_id
  LEFT JOIN public.classes cl
    ON cl.id = t.classe_id AND cl.escola_id = v_m.escola_id
  LEFT JOIN public.cursos c
    ON c.id = t.curso_id AND c.escola_id = v_m.escola_id
  WHERE mt.id = v_m.matricula_id
    AND mt.aluno_id = v_m.aluno_id
    AND mt.escola_id = v_m.escola_id
    AND mt.ano_letivo::text = v_m.ano_letivo::text
    AND t.ano_letivo::text = mt.ano_letivo::text
    AND (v_m.turma_id IS NULL OR v_m.turma_id = mt.turma_id)
  LIMIT 1;

  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  -- Inserir Documento Emitido com Snapshot enriquecido
  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_m.escola_id, v_m.aluno_id, v_m.id, 'recibo',
    jsonb_build_object(
      'mensalidade_id', v_m.id,
      'aluno_id', v_m.aluno_id,
      'aluno_nome', v_aluno.nome,
      'aluno_bi', v_aluno.bi_numero,
      'turma_nome', v_turma.turma_nome,
      'turma_turno', v_turma.turno,
      'classe_nome', v_turma.classe_nome,
      'curso_nome', v_turma.curso_nome,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento,
      'hash_validacao', v_hash_validacao
    ),
    v_user_id, v_hash_validacao
  )
  RETURNING id, public_id, created_at INTO v_doc;

  -- Disparar evento Outbox
  INSERT INTO public.outbox_events (
    escola_id,
    event_type,
    dedupe_key,
    idempotency_key,
    payload,
    tenant_scope
  )
  VALUES (
    v_m.escola_id,
    'pagamento.registado',
    'recibo:' || v_doc.id::text,
    'recibo:' || v_doc.id::text,
    jsonb_build_object(
      'doc_id', v_doc.id,
      'public_id', v_doc.public_id,
      'valor', v_m.valor_pago_total,
      'nome', v_aluno.nome,
      'mes', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY')
    ),
    'escola:' || v_m.escola_id::text
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.emitir_recibo_system(p_mensalidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_m record;
  v_aluno record;
  v_turma record;
  v_doc record;
  v_hash_validacao text;
  v_numero_sequencial int;
BEGIN
  -- 1. Selecionar dados da mensalidade
  SELECT * INTO v_m FROM public.mensalidades WHERE id = p_mensalidade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  -- 2. Verificar status de pagamento
  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  -- 3. Idempotência: Verificar se já existe recibo
  SELECT id, public_id, created_at INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo' AND mensalidade_id = p_mensalidade_id LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
  END IF;

  -- 4. Buscar dados do Aluno
  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = v_m.aluno_id;

  -- 5. Buscar turma pela matrícula da mensalidade (snapshot de emissão)
  SELECT t.nome as turma_nome, t.turno, cl.nome as classe_nome, c.nome as curso_nome
  INTO v_turma
  FROM public.matriculas mt
  JOIN public.turmas t
    ON t.id = mt.turma_id AND t.escola_id = v_m.escola_id
  LEFT JOIN public.classes cl
    ON cl.id = t.classe_id AND cl.escola_id = v_m.escola_id
  LEFT JOIN public.cursos c
    ON c.id = t.curso_id AND c.escola_id = v_m.escola_id
  WHERE mt.id = v_m.matricula_id
    AND mt.aluno_id = v_m.aluno_id
    AND mt.escola_id = v_m.escola_id
    AND mt.ano_letivo::text = v_m.ano_letivo::text
    AND t.ano_letivo::text = mt.ano_letivo::text
    AND (v_m.turma_id IS NULL OR v_m.turma_id = mt.turma_id)
  LIMIT 1;

  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');
  
  -- Gerar número sequencial oficial
  SELECT public.next_documento_numero(v_m.escola_id) INTO v_numero_sequencial;

  -- 6. Inserir Documento Emitido com Snapshot enriquecido
  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_m.escola_id, v_m.aluno_id, v_m.id, v_numero_sequencial, 'recibo',
    jsonb_build_object(
      'origem', 'sistema_automatico',
      'numero_sequencial', v_numero_sequencial,
      'mensalidade_id', v_m.id,
      'aluno_id', v_m.aluno_id,
      'aluno_nome', v_aluno.nome,
      'aluno_bi', v_aluno.bi_numero,
      'turma_nome', v_turma.turma_nome,
      'turma_turno', v_turma.turno,
      'classe_nome', v_turma.classe_nome,
      'curso_nome', v_turma.curso_nome,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento,
      'hash_validacao', v_hash_validacao
    ),
    NULL, v_hash_validacao
  )
  RETURNING id, public_id, created_at INTO v_doc;

  -- 7. Disparar evento Outbox para notificação (opcional, se desejar notificar o aluno)
  INSERT INTO public.outbox_events (
    escola_id,
    event_type,
    dedupe_key,
    idempotency_key,
    payload,
    tenant_scope
  )
  VALUES (
    v_m.escola_id,
    'notificacao.recibo_gerado',
    'notificacao_recibo:' || v_doc.id::text,
    'notificacao_recibo:' || v_doc.id::text,
    jsonb_build_object(
      'doc_id', v_doc.id,
      'public_id', v_doc.public_id,
      'valor', v_m.valor_pago_total,
      'nome', v_aluno.nome,
      'mes', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY')
    ),
    'escola:' || v_m.escola_id::text
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
END;
$function$;

-- Restrictivo: sem concessões adicionais a anon/authenticated.
