-- Migration: 20260227180000_automate_archive_and_live_events.sql
-- Descrição: Automatiza o disparo de eventos de arquivamento e notificações live para documentos.

BEGIN;

-- 1. Atualizar RPC emitir_recibo para disparar evento live
CREATE OR REPLACE FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_m public.mensalidades%ROWTYPE;
  v_doc record;
  v_hash_validacao text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m FROM public.mensalidades WHERE id = p_mensalidade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  SELECT id, public_id, created_at INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo' AND mensalidade_id = p_mensalidade_id LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
  END IF;

  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_m.escola_id, v_m.aluno_id, v_m.id, 'recibo',
    jsonb_build_object(
      'mensalidade_id', v_m.id,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento,
      'hash_validacao', v_hash_validacao
    ),
    v_user_id, v_hash_validacao
  )
  RETURNING id, public_id, created_at INTO v_doc;

  -- DISPARO DE EVENTO LIVE (Outbox)
  INSERT INTO public.outbox_events (escola_id, event_type, payload, tenant_scope)
  VALUES (
    v_m.escola_id, 
    'pagamento.registado', 
    jsonb_build_object(
      'doc_id', v_doc.id, 
      'public_id', v_doc.public_id,
      'valor', v_m.valor_pago_total,
      'nome', (SELECT nome FROM public.alunos WHERE id = v_m.aluno_id),
      'mes', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY')
    ),
    'escola:' || v_m.escola_id::text
  );

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc.id, 'public_id', v_doc.public_id, 'emitido_em', v_doc.created_at);
END;
$$;

-- 2. Atualizar RPC emitir_documento_final para disparar evento live
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
  v_resolved_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF v_resolved_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_resolved_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_resolved_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_historico_ano FROM public.historico_anos
  WHERE escola_id = v_resolved_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_historico_ano.turma_id;

  SELECT public.next_documento_numero(v_resolved_escola_id) INTO v_numero_sequencial;
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
    'tipo_documento', p_tipo_documento,
    'numero_sequencial', v_numero_sequencial,
    'hash_validacao', v_hash_validacao
  );

  INSERT INTO public.documentos_emitidos
    (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES
    (v_resolved_escola_id, p_aluno_id, v_numero_sequencial, p_tipo_documento, v_snapshot, v_actor_id, v_hash_validacao)
  RETURNING * INTO v_documento_emitido;

  -- DISPARO DE EVENTO LIVE (Outbox)
  INSERT INTO public.outbox_events (escola_id, event_type, payload, tenant_scope)
  VALUES (
    v_resolved_escola_id,
    'documento.emitido',
    jsonb_build_object(
      'doc_id', v_documento_emitido.id,
      'public_id', v_documento_emitido.public_id,
      'tipoDoc', p_tipo_documento,
      'nome', v_aluno.nome,
      'numero', v_numero_sequencial
    ),
    'escola:' || v_resolved_escola_id::text
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

-- 3. Função de gatilho para arquivamento automático de arquivos físicos
CREATE OR REPLACE FUNCTION public.trigger_archive_document_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se o pdf_path foi preenchido e não estava antes (ou mudou)
  IF (NEW.pdf_path IS NOT NULL AND NEW.pdf_path <> '') AND 
     (OLD.pdf_path IS NULL OR OLD.pdf_path <> NEW.pdf_path) THEN
    
    INSERT INTO public.outbox_events (
      escola_id,
      event_type,
      payload,
      tenant_scope
    )
    VALUES (
      NEW.escola_id,
      'ARCHIVE_DOCUMENT',
      jsonb_build_object(
        'source_bucket', 'pautas_oficiais_fechadas', -- Bucket padrão de pautas
        'source_path', NEW.pdf_path
      ),
      'escola:' || NEW.escola_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Aplicar gatilho na tabela pautas_oficiais
DROP TRIGGER IF EXISTS trg_pautas_archive_outbox ON public.pautas_oficiais;
CREATE TRIGGER trg_pautas_archive_outbox
AFTER INSERT OR UPDATE ON public.pautas_oficiais
FOR EACH ROW
EXECUTE FUNCTION public.trigger_archive_document_outbox();

COMMIT;
