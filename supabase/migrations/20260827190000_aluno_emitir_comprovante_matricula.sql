CREATE OR REPLACE FUNCTION public.aluno_emitir_comprovante_matricula(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid(); v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid := public.current_tenant_escola_id(); v_matricula record; v_aluno record; v_turma record; v_doc record;
  v_snapshot jsonb; v_numero integer; v_hash text;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN RAISE EXCEPTION 'AUTH: escola_id inválido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id AND (usuario_auth_id = v_actor OR profile_id = v_actor))
    AND NOT EXISTS (SELECT 1 FROM public.aluno_encarregados ae JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = p_escola_id WHERE ae.escola_id = p_escola_id AND ae.aluno_id = p_aluno_id AND lower(trim(e.email)) = v_email) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para emitir este documento.';
  END IF;
  SELECT id, aluno_id, turma_id, ano_letivo, status INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id AND aluno_id = p_aluno_id AND status IN ('ativa','ativo','matriculado') LIMIT 1;
  IF v_matricula.id IS NULL THEN RAISE EXCEPTION 'DATA: Matrícula ativa não encontrada.'; END IF;
  SELECT id, public_id, hash_validacao INTO v_doc FROM public.documentos_emitidos WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND tipo = 'comprovante_matricula' AND dados_snapshot->>'matricula_id' = p_matricula_id::text ORDER BY created_at DESC LIMIT 1;
  IF v_doc.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', true); END IF;
  SELECT nome, nome_completo, bi_numero, pai_nome, mae_nome, data_nascimento, naturalidade, provincia, endereco, encarregado_nome, encarregado_telefone INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
  SELECT t.nome, t.turno, c.nome AS classe_nome, cu.nome AS curso_nome INTO v_turma FROM public.turmas t LEFT JOIN public.classes c ON c.id = t.classe_id LEFT JOIN public.cursos cu ON cu.id = t.curso_id WHERE t.id = v_matricula.turma_id AND t.escola_id = p_escola_id;
  v_numero := public.next_documento_numero(p_escola_id); v_hash := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex');
  v_snapshot := jsonb_build_object('tipo_documento','comprovante_matricula','tipo_operacao','portal_aluno','matricula_id',p_matricula_id,'aluno_id',p_aluno_id,'aluno_nome',coalesce(v_aluno.nome_completo,v_aluno.nome),'aluno_bi',v_aluno.bi_numero,'aluno_pai',v_aluno.pai_nome,'aluno_mae',v_aluno.mae_nome,'aluno_nascimento',v_aluno.data_nascimento,'aluno_naturalidade',v_aluno.naturalidade,'aluno_provincia',v_aluno.provincia,'aluno_endereco',v_aluno.endereco,'encarregado_nome',v_aluno.encarregado_nome,'encarregado_telefone',v_aluno.encarregado_telefone,'turma_id',v_matricula.turma_id,'turma_nome',v_turma.nome,'turma_turno',v_turma.turno,'classe_nome',v_turma.classe_nome,'curso_nome',v_turma.curso_nome,'ano_letivo',v_matricula.ano_letivo,'status_matricula',v_matricula.status,'numero_sequencial',v_numero,'hash_validacao',v_hash);
  INSERT INTO public.documentos_emitidos (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao) VALUES (p_escola_id, p_aluno_id, v_numero, 'comprovante_matricula', v_snapshot, v_actor, v_hash) RETURNING id, public_id, hash_validacao INTO v_doc;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details) VALUES (p_escola_id, v_actor, 'COMPROVANTE_MATRICULA_EMITIDO_PORTAL', 'documentos_emitidos', v_doc.id::text, 'aluno', v_snapshot);
  RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', false);
END;
$$;

ALTER FUNCTION public.aluno_emitir_comprovante_matricula(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_emitir_comprovante_matricula(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_emitir_comprovante_matricula(uuid, uuid, uuid) TO authenticated;
