BEGIN;

-- =================================================================
-- RPC para Emissão de Documentos Finais
--
-- OBJETIVO:
-- 1. Garantir que documentos finais (certificados, históricos) sejam
--    gerados a partir dos dados consistentes e imutáveis das tabelas
--    `historico_anos` e `historico_disciplinas`.
-- 2. Auditar a emissão de cada documento.
-- =================================================================

CREATE OR REPLACE FUNCTION public.emitir_documento_final(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo int,
  p_tipo_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_historico_ano record;
  v_aluno record;
  v_turma record;
  v_documento_emitido record;
  v_numero_sequencial int;
  v_hash_validacao text;
  v_snapshot jsonb;
BEGIN
  -- 1. Validação de Permissões
  SELECT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  -- 2. Buscar o Histórico Anual (SSOT para documentos finais)
  SELECT * INTO v_historico_ano FROM public.historico_anos
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  -- 3. Obter dados adicionais para o snapshot
  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_historico_ano.turma_id;

  -- 4. Gerar número sequencial e hash de validação
  SELECT public.next_documento_numero(p_escola_id) INTO v_numero_sequencial;
  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  -- 5. Montar o Snapshot
  v_snapshot := jsonb_build_object(
    'aluno_id', p_aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'matricula_id', v_historico_ano.matricula_id, -- Referência histórica
    'turma_id', v_historico_ano.turma_id,
    'turma_nome', v_turma.nome,
    'turma_turno', v_turma.turno,
    'ano_letivo', v_historico_ano.ano_letivo,
    'status_final', v_historico_ano.status_final,
    'tipo_documento', p_tipo_documento,
    'numero_sequencial', v_numero_sequencial,
    'hash_validacao', v_hash_validacao
  );

  -- 6. Inserir o documento emitido
  INSERT INTO public.documentos_emitidos
    (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES
    (p_escola_id, p_aluno_id, v_numero_sequencial, p_tipo_documento, v_snapshot, v_actor_id, v_hash_validacao)
  RETURNING * INTO v_documento_emitido;

  -- 7. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'DOCUMENTO_FINAL_EMITIDO',
    'documentos_emitidos',
    v_documento_emitido.id::text,
    'secretaria',
    v_snapshot
  );

  RETURN jsonb_build_object(
    'ok', true,
    'docId', v_documento_emitido.id,
    'publicId', v_documento_emitido.public_id,
    'hash', v_documento_emitido.hash_validacao,
    'tipo', v_documento_emitido.tipo
  );

END;
$$;

ALTER FUNCTION public.emitir_documento_final(uuid, uuid, int, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.emitir_documento_final(uuid, uuid, int, text) TO authenticated;

COMMIT;
