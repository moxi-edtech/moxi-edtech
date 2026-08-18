-- Emite recibos para pagamentos de serviços sem mensalidade associada.
-- O snapshot é imutável e contém os itens que foram efectivamente cobrados.
CREATE OR REPLACE FUNCTION public.emitir_recibo_servicos(p_pagamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pagamento record;
  v_aluno record;
  v_turma record;
  v_doc record;
  v_hash text;
  v_numero bigint;
  v_snapshot jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT p.* INTO v_pagamento
  FROM public.pagamentos p
  WHERE p.id = p_pagamento_id
    AND p.mensalidade_id IS NULL
    AND p.status IN ('settled', 'concluido');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pagamento de serviço não encontrado ou ainda não liquidado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_pagamento.escola_id OR p.current_escola_id = v_pagamento.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  SELECT id, public_id, created_at INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo'
    AND escola_id = v_pagamento.escola_id
    AND (dados_snapshot->>'pagamento_id') = p_pagamento_id::text
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
  END IF;

  SELECT nome, bi_numero INTO v_aluno
  FROM public.alunos
  WHERE id = v_pagamento.aluno_id;

  SELECT t.nome AS turma_nome, cl.nome AS classe_nome, c.nome AS curso_nome
  INTO v_turma
  FROM public.matriculas m
  JOIN public.turmas t ON t.id = m.turma_id
  LEFT JOIN public.classes cl ON cl.id = t.classe_id
  LEFT JOIN public.cursos c ON c.id = t.curso_id
  WHERE m.aluno_id = v_pagamento.aluno_id
    AND m.escola_id = v_pagamento.escola_id
  ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC NULLS LAST
  LIMIT 1;

  v_hash := encode(sha256((random()::text || p_pagamento_id::text)::bytea), 'hex');
  SELECT public.next_documento_numero(v_pagamento.escola_id) INTO v_numero;

  v_snapshot := jsonb_build_object(
    'tipo_comprovativo', CASE
      WHEN lower(COALESCE(v_pagamento.meta->>'tipo_comprovativo', '')) LIKE '%confirm%'
        OR lower(COALESCE(v_pagamento.meta->>'origem', '')) LIKE '%rematric%'
      THEN 'confirmacao' ELSE 'pagamento' END,
    'pagamento_id', v_pagamento.id,
    'aluno_id', v_pagamento.aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'turma_nome', v_turma.turma_nome,
    'classe_nome', v_turma.classe_nome,
    'curso_nome', v_turma.curso_nome,
    'referencia', COALESCE(v_pagamento.meta->>'referencia', v_pagamento.meta->>'descricao_item', 'Serviços escolares'),
    'itens_pagamento', COALESCE(v_pagamento.meta->'itens_pagamento', v_pagamento.meta->'itens', jsonb_build_array(jsonb_build_object('descricao', COALESCE(v_pagamento.meta->>'descricao_item', 'Serviço escolar'), 'valor', v_pagamento.valor_pago))),
    'valor_pago', v_pagamento.valor_pago,
    'data_pagamento', v_pagamento.data_pagamento,
    'metodo', COALESCE(v_pagamento.metodo, v_pagamento.metodo_pagamento),
    'numero_sequencial', v_numero,
    'hash_validacao', v_hash
  );

  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_pagamento.escola_id, v_pagamento.aluno_id, v_numero, 'recibo', v_snapshot, v_user_id, v_hash
  )
  RETURNING id, public_id, created_at INTO v_doc;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_recibo_servicos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_recibo_servicos(uuid) TO authenticated;
