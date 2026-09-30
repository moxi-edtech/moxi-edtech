ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'cartao_estudante';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'ficha_inscricao';

CREATE OR REPLACE FUNCTION public.aluno_emitir_documento_operacional(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_id uuid, p_tipo_documento text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_email text := lower(trim(COALESCE(auth.jwt()->>'email', '')));
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record; v_aluno record; v_turma record; v_doc record;
  v_snapshot jsonb; v_numero integer; v_hash text;
BEGIN
  IF p_tipo_documento NOT IN ('cartao_estudante', 'ficha_inscricao') THEN
    RAISE EXCEPTION 'DATA: Tipo de documento operacional inválido.';
  END IF;
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id
      AND (usuario_auth_id = v_actor_id OR profile_id = v_actor_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.aluno_encarregados ae
    JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = p_escola_id
    WHERE ae.escola_id = p_escola_id AND ae.aluno_id = p_aluno_id AND lower(trim(e.email)) = v_email
  ) THEN RAISE EXCEPTION 'AUTH: Você não tem permissão para emitir este documento.'; END IF;

  SELECT id, aluno_id, turma_id, ano_letivo INTO v_matricula FROM public.matriculas
  WHERE id = p_matricula_id AND escola_id = p_escola_id AND aluno_id = p_aluno_id AND status IN ('ativa', 'ativo') LIMIT 1;
  IF v_matricula.id IS NULL THEN RAISE EXCEPTION 'DATA: Matrícula ativa não encontrada.'; END IF;
  SELECT id, public_id, hash_validacao INTO v_doc FROM public.documentos_emitidos
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND tipo = p_tipo_documento::public.tipo_documento
    AND dados_snapshot->>'matricula_id' = p_matricula_id::text ORDER BY created_at DESC LIMIT 1;
  IF v_doc.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', true); END IF;

  SELECT nome, nome_completo, bi_numero, numero_processo, data_nascimento, encarregado_nome, encarregado_telefone INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_matricula.turma_id AND escola_id = p_escola_id;
  v_numero := public.next_documento_numero(p_escola_id);
  v_hash := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex');
  v_snapshot := jsonb_build_object('aluno_id', p_aluno_id, 'aluno_nome', COALESCE(v_aluno.nome_completo, v_aluno.nome), 'aluno_bi', v_aluno.bi_numero, 'processo_individual_numero', v_aluno.numero_processo, 'data_nascimento', v_aluno.data_nascimento, 'encarregado_nome', v_aluno.encarregado_nome, 'encarregado_telefone', v_aluno.encarregado_telefone, 'matricula_id', p_matricula_id, 'turma_id', v_matricula.turma_id, 'turma_nome', v_turma.nome, 'turma_turno', v_turma.turno, 'ano_letivo', v_matricula.ano_letivo, 'tipo_documento', p_tipo_documento, 'numero_sequencial', v_numero, 'hash_validacao', v_hash);
  INSERT INTO public.documentos_emitidos (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES (p_escola_id, p_aluno_id, v_numero, p_tipo_documento::public.tipo_documento, v_snapshot, v_actor_id, v_hash)
  RETURNING id, public_id, hash_validacao INTO v_doc;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details) VALUES (p_escola_id, v_actor_id, 'DOCUMENTO_OPERACIONAL_EMITIDO', 'documentos_emitidos', v_doc.id::text, 'aluno', v_snapshot);
  RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', false);
END;
$$;

ALTER FUNCTION public.aluno_emitir_documento_operacional(uuid, uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_emitir_documento_operacional(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_emitir_documento_operacional(uuid, uuid, uuid, text) TO authenticated;
