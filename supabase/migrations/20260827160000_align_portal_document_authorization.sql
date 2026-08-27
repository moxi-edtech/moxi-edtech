-- Alinha aluno e encarregado ao mesmo universo de alunos autorizados pelo portal.
CREATE OR REPLACE FUNCTION public.aluno_solicitar_servico(
  p_escola_id uuid, p_aluno_id uuid, p_servico_codigo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_email text := lower(trim(COALESCE(auth.jwt()->>'email', '')));
  v_serv record;
  v_matricula_id uuid;
  v_pedido_id uuid;
  v_pagamento_id uuid;
  v_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id
      AND (usuario_auth_id = v_actor_id OR profile_id = v_actor_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.aluno_encarregados ae
    JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = p_escola_id
    WHERE ae.escola_id = p_escola_id AND ae.aluno_id = p_aluno_id AND lower(trim(e.email)) = v_email
  ) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para solicitar serviços para este aluno.';
  END IF;

  SELECT * INTO v_serv FROM public.servicos_escola WHERE escola_id = p_escola_id AND codigo = p_servico_codigo AND ativo = true;
  IF v_serv.id IS NULL THEN RAISE EXCEPTION 'DATA: Serviço não encontrado ou inativo.'; END IF;
  SELECT id INTO v_matricula_id FROM public.matriculas
    WHERE aluno_id = p_aluno_id AND escola_id = p_escola_id AND status IN ('ativo', 'ativa')
    ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT id, status INTO v_pedido_id, v_status FROM public.servico_pedidos
    WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND servico_codigo = p_servico_codigo
      AND status IN ('pending_payment', 'blocked') ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_pedido_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Você já possui uma solicitação em andamento para este documento.', 'pedido_id', v_pedido_id, 'status', v_status);
  END IF;

  IF v_serv.valor_base = 0 AND NOT v_serv.exige_aprovacao THEN v_status := 'granted';
  ELSIF v_serv.valor_base > 0 THEN v_status := 'pending_payment';
  ELSE v_status := 'blocked'; END IF;

  INSERT INTO public.servico_pedidos (escola_id, aluno_id, matricula_id, servico_escola_id, status, servico_codigo, servico_nome, valor_cobrado, created_by)
  VALUES (p_escola_id, p_aluno_id, v_matricula_id, v_serv.id, v_status, v_serv.codigo, v_serv.nome, v_serv.valor_base, v_actor_id)
  RETURNING id INTO v_pedido_id;
  IF v_serv.valor_base > 0 THEN
    INSERT INTO public.pagamento_intents (escola_id, aluno_id, servico_pedido_id, amount, status, method, created_by)
    VALUES (p_escola_id, p_aluno_id, v_pedido_id, v_serv.valor_base, 'draft', 'transfer', v_actor_id)
    RETURNING id INTO v_pagamento_id;
  END IF;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (p_escola_id, v_actor_id, 'SERVICO_SOLICITADO_ALUNO', 'servico_pedidos', v_pedido_id::text, 'aluno', jsonb_build_object('servico', p_servico_codigo, 'valor', v_serv.valor_base));
  RETURN jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'pagamento_id', v_pagamento_id, 'status', v_status, 'valor', v_serv.valor_base);
END;
$$;

CREATE OR REPLACE FUNCTION public.aluno_emitir_declaracao_frequencia(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_email text := lower(trim(COALESCE(auth.jwt()->>'email', '')));
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record; v_aluno record; v_turma record; v_doc record;
  v_snapshot jsonb; v_numero integer; v_hash text;
BEGIN
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN RAISE EXCEPTION 'AUTH: escola_id inválido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id AND (usuario_auth_id = v_actor_id OR profile_id = v_actor_id))
     AND NOT EXISTS (SELECT 1 FROM public.aluno_encarregados ae JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = p_escola_id WHERE ae.escola_id = p_escola_id AND ae.aluno_id = p_aluno_id AND lower(trim(e.email)) = v_email) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para emitir este documento.';
  END IF;
  SELECT id, aluno_id, turma_id, ano_letivo INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id AND aluno_id = p_aluno_id AND status IN ('ativa', 'ativo') LIMIT 1;
  IF v_matricula.id IS NULL THEN RAISE EXCEPTION 'DATA: Matrícula ativa não encontrada.'; END IF;
  SELECT id, public_id, hash_validacao INTO v_doc FROM public.documentos_emitidos WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND tipo = 'declaracao_frequencia' AND dados_snapshot->>'matricula_id' = p_matricula_id::text ORDER BY created_at DESC LIMIT 1;
  IF v_doc.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', true); END IF;
  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_matricula.turma_id AND escola_id = p_escola_id;
  v_numero := public.next_documento_numero(p_escola_id); v_hash := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex');
  v_snapshot := jsonb_build_object('aluno_id', p_aluno_id, 'aluno_nome', v_aluno.nome, 'aluno_bi', v_aluno.bi_numero, 'matricula_id', p_matricula_id, 'turma_id', v_matricula.turma_id, 'turma_nome', v_turma.nome, 'turma_turno', v_turma.turno, 'ano_letivo', v_matricula.ano_letivo, 'tipo_documento', 'declaracao_frequencia', 'numero_sequencial', v_numero, 'hash_validacao', v_hash);
  INSERT INTO public.documentos_emitidos (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao) VALUES (p_escola_id, p_aluno_id, v_numero, 'declaracao_frequencia', v_snapshot, v_actor_id, v_hash) RETURNING id, public_id, hash_validacao INTO v_doc;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details) VALUES (p_escola_id, v_actor_id, 'DOCUMENTO_FREQUENCIA_EMITIDO', 'documentos_emitidos', v_doc.id::text, 'aluno', v_snapshot);
  RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', false);
END;
$$;

ALTER FUNCTION public.aluno_solicitar_servico(uuid, uuid, text) OWNER TO postgres;
ALTER FUNCTION public.aluno_emitir_declaracao_frequencia(uuid, uuid, uuid) OWNER TO postgres;
