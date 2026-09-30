CREATE OR REPLACE FUNCTION public.aluno_emitir_documento_final(
  p_escola_id uuid, p_aluno_id uuid, p_ano_letivo integer, p_tipo_documento text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid(); v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid := public.current_tenant_escola_id(); v_hist record; v_aluno record; v_turma record; v_doc record;
  v_numero integer; v_hash text; v_snapshot jsonb;
BEGIN
  IF p_tipo_documento NOT IN ('historico', 'certificado') THEN RAISE EXCEPTION 'DATA: Tipo de documento final inválido.'; END IF;
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN RAISE EXCEPTION 'AUTH: escola_id inválido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id AND (usuario_auth_id = v_actor OR profile_id = v_actor))
    AND NOT EXISTS (SELECT 1 FROM public.aluno_encarregados ae JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = p_escola_id WHERE ae.escola_id = p_escola_id AND ae.aluno_id = p_aluno_id AND lower(trim(e.email)) = v_email) THEN
    RAISE EXCEPTION 'AUTH: Você não tem permissão para emitir este documento.';
  END IF;
  SELECT * INTO v_hist FROM public.historico_anos WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo LIMIT 1;
  IF v_hist.id IS NULL THEN
    SELECT * INTO v_hist FROM public.historico_anos
    WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND coalesce(snapshot_status, 'aberto') = 'fechado'
    ORDER BY ano_letivo DESC, id DESC LIMIT 1;
  END IF;
  IF v_hist.id IS NULL THEN RAISE EXCEPTION 'LEGAL_LOCK: histórico anual ainda não foi fechado.'; END IF;
  IF coalesce(v_hist.snapshot_status, 'aberto') <> 'fechado' THEN RAISE EXCEPTION 'LEGAL_LOCK: histórico anual ainda não foi fechado.'; END IF;
  SELECT id, public_id, hash_validacao INTO v_doc FROM public.documentos_emitidos WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND tipo = p_tipo_documento::public.tipo_documento AND dados_snapshot->>'ano_letivo' = p_ano_letivo::text ORDER BY created_at DESC LIMIT 1;
  IF v_doc.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', true); END IF;
  SELECT nome, nome_completo, bi_numero, numero_processo, data_nascimento INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
  SELECT t.nome, t.turno, c.nome AS classe_nome, cu.nome AS curso_nome INTO v_turma FROM public.turmas t LEFT JOIN public.classes c ON c.id = t.classe_id LEFT JOIN public.cursos cu ON cu.id = t.curso_id WHERE t.id = v_hist.turma_id AND t.escola_id = p_escola_id;
  v_numero := public.next_documento_numero(p_escola_id); v_hash := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex');
  v_snapshot := jsonb_build_object('aluno_id', p_aluno_id, 'aluno_nome', coalesce(v_aluno.nome_completo, v_aluno.nome), 'aluno_bi', v_aluno.bi_numero, 'processo_individual_numero', v_aluno.numero_processo, 'data_nascimento', v_aluno.data_nascimento, 'matricula_id', v_hist.matricula_id, 'turma_id', v_hist.turma_id, 'turma_nome', v_turma.nome, 'turma_turno', v_turma.turno, 'classe_nome', v_turma.classe_nome, 'curso_nome', v_turma.curso_nome, 'ano_letivo', p_ano_letivo, 'status_final', v_hist.status_final, 'snapshot_status', v_hist.snapshot_status, 'tipo_documento', p_tipo_documento, 'numero_sequencial', v_numero, 'hash_validacao', v_hash);
  INSERT INTO public.documentos_emitidos (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao) VALUES (p_escola_id, p_aluno_id, v_numero, p_tipo_documento::public.tipo_documento, v_snapshot, v_actor, v_hash) RETURNING id, public_id, hash_validacao INTO v_doc;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details) VALUES (p_escola_id, v_actor, 'DOCUMENTO_FINAL_EMITIDO_PORTAL', 'documentos_emitidos', v_doc.id::text, 'aluno', v_snapshot);
  RETURN jsonb_build_object('ok', true, 'docId', v_doc.id, 'publicId', v_doc.public_id, 'hash', v_doc.hash_validacao, 'reused', false);
END;
$$;

ALTER FUNCTION public.aluno_emitir_documento_final(uuid, uuid, integer, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_emitir_documento_final(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_emitir_documento_final(uuid, uuid, integer, text) TO authenticated;
