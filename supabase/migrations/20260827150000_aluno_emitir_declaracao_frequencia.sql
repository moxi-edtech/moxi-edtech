CREATE OR REPLACE FUNCTION public.aluno_emitir_declaracao_frequencia(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_aluno record;
  v_turma record;
  v_doc record;
  v_snapshot jsonb;
  v_numero integer;
  v_hash text;
BEGIN
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id AND (usuario_auth_id = v_actor_id OR profile_id = v_actor_id)) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para emitir este documento.';
  END IF;
  SELECT id, aluno_id, turma_id, ano_letivo INTO v_matricula
  FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id AND aluno_id = p_aluno_id AND status IN ('ativa', 'ativo') LIMIT 1;
  IF v_matricula.id IS NULL THEN RAISE EXCEPTION 'DATA: Matrícula ativa não encontrada.'; END IF;

  SELECT id, public_id, hash_validacao INTO v_doc FROM public.documentos_emitidos
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND tipo = 'declaracao_frequencia'
    AND dados_snapshot->>'matricula_id' = p_matricula_id::text ORDER BY created_at DESC LIMIT 1;
  IF v_doc.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', true);
  END IF;

  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_matricula.turma_id AND escola_id = p_escola_id;
  v_numero := public.next_documento_numero(p_escola_id);
  v_hash := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex');
  v_snapshot := jsonb_build_object('aluno_id', p_aluno_id, 'aluno_nome', v_aluno.nome, 'aluno_bi', v_aluno.bi_numero, 'matricula_id', p_matricula_id, 'turma_id', v_matricula.turma_id, 'turma_nome', v_turma.nome, 'turma_turno', v_turma.turno, 'ano_letivo', v_matricula.ano_letivo, 'tipo_documento', 'declaracao_frequencia', 'numero_sequencial', v_numero, 'hash_validacao', v_hash);
  INSERT INTO public.documentos_emitidos (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES (p_escola_id, p_aluno_id, v_numero, 'declaracao_frequencia', v_snapshot, v_actor_id, v_hash)
  RETURNING id, public_id, hash_validacao INTO v_doc;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (p_escola_id, v_actor_id, 'DOCUMENTO_FREQUENCIA_EMITIDO', 'documentos_emitidos', v_doc.id::text, 'aluno', v_snapshot);
  RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', false);
END;
$$;

ALTER FUNCTION public.aluno_emitir_declaracao_frequencia(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_emitir_declaracao_frequencia(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_emitir_declaracao_frequencia(uuid, uuid, uuid) TO authenticated;
