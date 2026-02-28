BEGIN;

CREATE OR REPLACE FUNCTION public.nota_para_extenso_ptao(p_nota numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_nota int := ROUND(COALESCE(p_nota, 0));
BEGIN
  IF v_nota < 0 OR v_nota > 20 THEN
    RETURN 'Nota inválida';
  END IF;

  RETURN (
    ARRAY[
      'Zero', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove',
      'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezasseis', 'Dezassete', 'Dezoito', 'Dezanove', 'Vinte'
    ]
  )[v_nota + 1] || ' valores';
END;
$$;

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
  v_escola_id uuid := public.current_tenant_escola_id();
  v_media_final numeric(6,2);
  v_media_extenso text;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_historico_ano FROM public.historico_anos
  WHERE escola_id = v_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_historico_ano.turma_id;

  v_media_final := COALESCE(
    v_historico_ano.media_geral,
    (
      SELECT ROUND(AVG(hd.media_final))::numeric(6,2)
      FROM public.historico_disciplinas hd
      WHERE hd.historico_ano_id = v_historico_ano.id
    ),
    0
  );
  v_media_extenso := public.nota_para_extenso_ptao(v_media_final);

  SELECT public.next_documento_numero(v_escola_id) INTO v_numero_sequencial;
  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  v_snapshot := jsonb_build_object(
    'aluno_id', p_aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'matricula_id', v_historico_ano.matricula_id,
    'turma_id', v_historico_ano.turma_id,
    'turma_nome', v_turma.nome,
    'turma_turno', v_turma.turno,
    'ano_letivo', v_historico_ano.ano_letivo,
    'status_final', v_historico_ano.status_final,
    'media_final', v_media_final,
    'media_extenso', v_media_extenso,
    'tipo_documento', p_tipo_documento,
    'numero_sequencial', v_numero_sequencial,
    'hash_validacao', v_hash_validacao
  );

  INSERT INTO public.documentos_emitidos
    (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES
    (v_escola_id, p_aluno_id, v_numero_sequencial, p_tipo_documento, v_snapshot, v_actor_id, v_hash_validacao)
  RETURNING * INTO v_documento_emitido;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
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
    'tipo', v_documento_emitido.tipo,
    'media_final', v_media_final,
    'media_extenso', v_media_extenso
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nota_para_extenso_ptao(numeric) TO authenticated;

COMMIT;
