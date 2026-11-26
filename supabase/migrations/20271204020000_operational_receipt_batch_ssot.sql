-- Operational receipts only. No fiscal RPC or fiscal configuration changes.
-- Batch identity comes from persisted settled payments, not client payload.
CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.operational_receipt_batch_contract(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_source public.pagamentos%ROWTYPE;
  v_issuer public.pagamentos%ROWTYPE;
  v_batch text;
  v_fingerprint text;
  v_items jsonb;
  v_item jsonb;
  v_payment public.pagamentos%ROWTYPE;
  v_amount numeric;
  v_total numeric := 0;
  v_count integer;
  v_issuer_count integer;
  v_idx integer;
  v_ids jsonb := '[]'::jsonb;
  v_normalized jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO STRICT v_source FROM public.pagamentos WHERE id=p_payment_id;
  v_batch := nullif(v_source.meta->>'batch_idempotency_key','');
  v_fingerprint := nullif(v_source.meta->>'batch_fingerprint','');
  IF v_batch IS NULL OR v_fingerprint IS NULL OR v_source.status <> 'settled'
     OR v_source.escola_id IS NULL OR v_source.aluno_id IS NULL THEN
    RAISE EXCEPTION 'RECEIPT_BATCH_INVALID_SOURCE';
  END IF;
  -- Serialize all issuers/reconciliation on the same scoped identity.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'operational-receipt:' || v_source.escola_id::text || ':' || v_source.aluno_id::text || ':' || v_batch, 0));
  -- Lock the settled evidence through the document insert/audit transaction.
  PERFORM 1 FROM public.pagamentos p
   WHERE p.escola_id=v_source.escola_id AND p.aluno_id=v_source.aluno_id
     AND p.meta->>'batch_idempotency_key'=v_batch ORDER BY p.id FOR SHARE;
  SELECT count(*),count(*) FILTER (WHERE p.meta->'emitir_recibo'='true'::jsonb)
    INTO v_count,v_issuer_count
    FROM public.pagamentos p
   WHERE p.escola_id=v_source.escola_id AND p.aluno_id=v_source.aluno_id
     AND p.meta->>'batch_idempotency_key'=v_batch;
  IF v_count<1 OR v_issuer_count<>1 OR EXISTS (
    SELECT 1 FROM public.pagamentos p
     WHERE p.escola_id=v_source.escola_id AND p.aluno_id=v_source.aluno_id
       AND p.meta->>'batch_idempotency_key'=v_batch
       AND (p.status IS DISTINCT FROM 'settled' OR p.valor_pago IS NULL OR p.valor_pago<=0
         OR p.meta->>'batch_fingerprint' IS DISTINCT FROM v_fingerprint
         OR coalesce(p.meta->'emitir_recibo' IN ('true'::jsonb,'false'::jsonb),false)=false)
  ) THEN RAISE EXCEPTION 'RECEIPT_BATCH_UNSETTLED_OR_AMBIGUOUS'; END IF;
  SELECT * INTO STRICT v_issuer FROM public.pagamentos p
   WHERE p.escola_id=v_source.escola_id AND p.aluno_id=v_source.aluno_id
     AND p.meta->>'batch_idempotency_key'=v_batch AND p.meta->'emitir_recibo'='true'::jsonb;
  v_items := coalesce(v_issuer.meta->'itens_pagamento',v_issuer.meta->'itens');
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'RECEIPT_BATCH_ITEMS_REQUIRED'; END IF;
  IF jsonb_array_length(v_items)<>v_count THEN RAISE EXCEPTION 'RECEIPT_BATCH_ITEM_COUNT'; END IF;
  FOR v_idx IN 0..v_count-1 LOOP
    v_item := v_items->v_idx;
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'RECEIPT_BATCH_ITEM_INVALID'; END IF;
    SELECT * INTO STRICT v_payment FROM public.pagamentos p
     WHERE p.escola_id=v_source.escola_id AND p.aluno_id=v_source.aluno_id
       AND p.meta->>'batch_idempotency_key'=v_batch AND p.meta->>'batch_index'=v_idx::text;
    IF (v_payment.id=v_issuer.id) IS DISTINCT FROM (v_idx=v_count-1) THEN RAISE EXCEPTION 'RECEIPT_BATCH_TERMINAL_MISMATCH'; END IF;
    v_amount := coalesce(v_item->>'valor',v_item->>'amount',v_item->>'preco')::numeric;
    IF v_amount IS NULL OR v_amount IS DISTINCT FROM v_payment.valor_pago
      OR NOT coalesce((v_item->>'tipo'='mensalidade' AND v_payment.mensalidade_id::text=v_item->>'id')
          OR (v_item->>'tipo'='servico' AND v_payment.mensalidade_id IS NULL),false)
      OR (v_payment.mensalidade_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.mensalidades m WHERE m.id=v_payment.mensalidade_id
          AND m.escola_id=v_source.escola_id AND m.aluno_id=v_source.aluno_id))
      THEN RAISE EXCEPTION 'RECEIPT_BATCH_ITEM_PAYMENT_MISMATCH'; END IF;
    v_total := v_total+v_payment.valor_pago;
    v_ids := v_ids || jsonb_build_array(v_payment.id);
    v_normalized := v_normalized || jsonb_build_array(v_item || jsonb_build_object(
      'valor',v_payment.valor_pago,'pagamento_id',v_payment.id));
  END LOOP;
  RETURN jsonb_build_object('escola_id',v_source.escola_id,'aluno_id',v_source.aluno_id,
    'batch_idempotency_key',v_batch,'batch_fingerprint',v_fingerprint,'pagamento_id',v_issuer.id,
    'mensalidade_id',v_issuer.mensalidade_id,'pagamentos_ids',v_ids,
    'itens_originais',v_items,'itens_pagamento',v_normalized,'valor_pago',v_total);
END;
$$;
REVOKE ALL ON FUNCTION internal.operational_receipt_batch_contract(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Single issuance path shared by synchronous checkout and outbox worker.
CREATE OR REPLACE FUNCTION internal.issue_operational_batch_receipt(p_payment_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  c jsonb;
  p public.pagamentos%ROWTYPE;
  d public.documentos_emitidos%ROWTYPE;
  v_student record;
  v_academic record;
  v_num bigint;
  v_hash text;
  v_key text;
  v_existing_count integer;
BEGIN
  c := internal.operational_receipt_batch_contract(p_payment_id);
  SELECT * INTO STRICT p FROM public.pagamentos WHERE id=(c->>'pagamento_id')::uuid;
  v_key := 'operational_batch:' || encode(sha256(convert_to(
     p.escola_id::text || ':' || p.aluno_id::text || ':' || (c->>'batch_idempotency_key'),'UTF8')),'hex');
  SELECT count(*) INTO v_existing_count FROM public.documentos_emitidos x
   WHERE x.escola_id=p.escola_id AND x.aluno_id=p.aluno_id AND x.tipo='recibo'
     AND (x.idempotency_key=v_key OR x.dados_snapshot->>'pagamento_id'=p.id::text);
  IF v_existing_count>1 THEN RAISE EXCEPTION 'RECEIPT_BATCH_DUPLICATE_DOCUMENT'; END IF;
  SELECT * INTO d FROM public.documentos_emitidos x
   WHERE x.escola_id=p.escola_id AND x.aluno_id=p.aluno_id AND x.tipo='recibo'
     AND (x.idempotency_key=v_key OR x.dados_snapshot->>'pagamento_id'=p.id::text);
  IF FOUND THEN
    IF d.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'RECEIPT_BATCH_REVOKED'; END IF;
    RETURN jsonb_build_object('ok',true,'doc_id',d.id,'public_id',d.public_id,'emitido_em',d.created_at);
  END IF;
  -- Do not silently duplicate or overwrite a legacy receipt of the terminal month.
  IF p.mensalidade_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.documentos_emitidos x WHERE x.escola_id=p.escola_id
      AND x.aluno_id=p.aluno_id AND x.tipo='recibo' AND x.mensalidade_id=p.mensalidade_id
  ) THEN RAISE EXCEPTION 'RECEIPT_BATCH_LEGACY_REQUIRES_RECONCILIATION'; END IF;

  SELECT a.nome,a.bi_numero INTO STRICT v_student FROM public.alunos a
   WHERE a.id=p.aluno_id AND a.escola_id=p.escola_id;
  -- Only use the charged enrollment or explicit checkout enrollment; no latest-year fallback.
  SELECT t.nome turma_nome,t.turno,cl.nome classe_nome,cu.nome curso_nome INTO v_academic
  FROM public.matriculas m
  JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=p.escola_id AND t.ano_letivo=m.ano_letivo
  LEFT JOIN public.classes cl ON cl.id=t.classe_id AND cl.escola_id=p.escola_id
  LEFT JOIN public.cursos cu ON cu.id=t.curso_id AND cu.escola_id=p.escola_id
  WHERE m.escola_id=p.escola_id AND m.aluno_id=p.aluno_id
    AND (CASE WHEN p.mensalidade_id IS NOT NULL THEN m.id=(
      SELECT mm.matricula_id FROM public.mensalidades mm WHERE mm.id=p.mensalidade_id
        AND mm.escola_id=p.escola_id AND mm.aluno_id=p.aluno_id AND mm.ano_letivo::text=m.ano_letivo::text)
      ELSE m.id::text=p.meta->>'matricula_id' AND EXISTS (
        SELECT 1 FROM public.anos_letivos y WHERE y.escola_id=p.escola_id
          AND y.id::text=p.meta->>'ano_letivo_id' AND y.ano=m.ano_letivo) END)
  LIMIT 1;
  v_hash := encode(sha256(convert_to(gen_random_uuid()::text || p.id::text,'UTF8')),'hex');
  v_num := public.next_documento_numero(p.escola_id);
  INSERT INTO public.documentos_emitidos(escola_id,aluno_id,mensalidade_id,numero_sequencial,
    tipo,idempotency_key,idempotency_fingerprint,dados_snapshot,created_by,hash_validacao)
  VALUES(p.escola_id,p.aluno_id,p.mensalidade_id,v_num,'recibo',v_key,c->>'batch_fingerprint',
    (c-'itens_originais') || jsonb_build_object(
      'origem','operational_batch_ssot','tipo_comprovativo',CASE
       WHEN lower(coalesce(p.meta->>'tipo_comprovativo','')) LIKE '%confirm%'
        OR lower(coalesce(p.meta->>'origem','')) LIKE '%rematric%' THEN 'confirmacao' ELSE 'pagamento' END,
      'aluno_nome',v_student.nome,'aluno_bi',v_student.bi_numero,'turma_nome',v_academic.turma_nome,
      'turma_turno',v_academic.turno,'classe_nome',v_academic.classe_nome,'curso_nome',v_academic.curso_nome,
      'referencia',coalesce(p.meta->>'referencia',p.meta->>'descricao_item','Pagamento escolar'),
      'data_pagamento',p.data_pagamento,'metodo',coalesce(p.metodo,p.metodo_pagamento),
      'numero_sequencial',v_num,'hash_validacao',v_hash),p_actor,v_hash)
  RETURNING * INTO d;
  RETURN jsonb_build_object('ok',true,'doc_id',d.id,'public_id',d.public_id,'emitido_em',d.created_at);
END;
$$;
REVOKE ALL ON FUNCTION internal.issue_operational_batch_receipt(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Monthly entrypoints must resolve the existing batch rather than issuing a second receipt.
CREATE OR REPLACE FUNCTION internal.operational_batch_payment_for_month(p_month uuid,p_school uuid,p_student uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE p public.pagamentos%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.pagamentos x WHERE x.escola_id=p_school AND x.aluno_id=p_student
    AND x.mensalidade_id=p_month AND x.status='settled'
    ORDER BY x.created_at DESC,x.id DESC LIMIT 1;
  IF FOUND AND nullif(p.meta->>'batch_idempotency_key','') IS NOT NULL THEN RETURN p.id; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION internal.operational_batch_payment_for_month(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Append-only reconciliation evidence (original snapshot, unchanged public identity).
CREATE TABLE IF NOT EXISTS internal.operational_receipt_reconciliation (
  documento_id uuid PRIMARY KEY REFERENCES public.documentos_emitidos(id),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  original_snapshot jsonb NOT NULL,
  original_total numeric NOT NULL,
  reconciled_total numeric NOT NULL,
  batch_evidence jsonb NOT NULL,
  original_hash text,
  original_public_id text NOT NULL,
  original_number bigint,
  reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reconciled_by text NOT NULL DEFAULT current_user,
  reason text NOT NULL CHECK (reason='operational_batch_terminal_amount')
);
ALTER TABLE internal.operational_receipt_reconciliation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal.operational_receipt_reconciliation FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._emitir_recibo_servicos_operacional_internal(p_pagamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF nullif(v_pagamento.meta->>'batch_idempotency_key','') IS NOT NULL THEN
    RETURN internal.issue_operational_batch_receipt(v_pagamento.id,v_user_id);
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

  -- O ano do checkout validado é preferencial; pagamentos antigos sem esse
  -- metadado usam o ano letivo ativo da escola. Nunca ordenar pela alteração
  -- mais recente: uma reconciliação pode atualizar a matrícula concluída.
  -- Sem matrícula ativa desse ano, não inventar a classe de outro ano.
  SELECT t.nome AS turma_nome, cl.nome AS classe_nome, c.nome AS curso_nome
  INTO v_turma
  FROM public.matriculas m
  JOIN public.turmas t
    ON t.id = m.turma_id
   AND t.escola_id = v_pagamento.escola_id
   AND t.ano_letivo = m.ano_letivo
  LEFT JOIN public.classes cl
    ON cl.id = t.classe_id AND cl.escola_id = v_pagamento.escola_id
  LEFT JOIN public.cursos c
    ON c.id = t.curso_id AND c.escola_id = v_pagamento.escola_id
  WHERE m.aluno_id = v_pagamento.aluno_id
    AND m.escola_id = v_pagamento.escola_id
    AND m.status IN ('ativo', 'ativa')
    AND m.ano_letivo = COALESCE(
      (
        SELECT al.ano
        FROM public.anos_letivos al
        WHERE al.escola_id = v_pagamento.escola_id
          AND al.id::text = v_pagamento.meta->>'ano_letivo_id'
        LIMIT 1
      ),
      (
        SELECT al.ano
        FROM public.anos_letivos al
        WHERE al.escola_id = v_pagamento.escola_id
          AND al.ativo IS TRUE
        ORDER BY al.data_inicio DESC, al.id DESC
        LIMIT 1
      )
    )
  ORDER BY m.created_at DESC, m.id DESC
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
$function$;

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
  v_batch_payment uuid;
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

  v_batch_payment := internal.operational_batch_payment_for_month(v_m.id,v_m.escola_id,v_m.aluno_id);
  IF v_batch_payment IS NOT NULL THEN
    RETURN internal.issue_operational_batch_receipt(v_batch_payment,v_user_id);
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
  v_batch_payment uuid;
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

  v_batch_payment := internal.operational_batch_payment_for_month(v_m.id,v_m.escola_id,v_m.aluno_id);
  IF v_batch_payment IS NOT NULL THEN
    RETURN internal.issue_operational_batch_receipt(v_batch_payment,NULL);
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

CREATE OR REPLACE FUNCTION public.process_operational_receipt_outbox(p_limit integer DEFAULT 20)
 RETURNS TABLE(issued_count integer, skipped_count integer, failed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_cutover timestamptz;
  v_active boolean;
  v_event public.outbox_events%ROWTYPE;
  v_payment public.pagamentos%ROWTYPE;
  v_monthly public.mensalidades%ROWTYPE;
  v_aluno_nome text;
  v_aluno_bi text;
  v_document_id uuid;
  v_monthly_id uuid;
  v_payment_id uuid;
  v_rpc jsonb;
  v_key text;
  v_fingerprint text;
  v_hash text;
  v_numero integer;
  v_items jsonb;
  v_total numeric;
  v_receipt_kind text;
  v_error text;
BEGIN
  issued_count := 0;
  skipped_count := 0;
  failed_count := 0;

  SELECT c.started_at, c.enabled INTO v_cutover, v_active
    FROM public.operational_receipt_worker_control c WHERE c.singleton;
  IF NOT FOUND OR NOT v_active THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- Locking each event prevents overlapping cron invocations from double-claiming.
  -- The pre-cutover backlog must be reconciled, not automatically fiscalized.
  FOR v_event IN
    SELECT e.*
      FROM public.outbox_events e
     WHERE e.event_type = 'financeiro_recibo_pagamento'
       AND e.status IN ('pending', 'failed')
       AND e.created_at >= v_cutover
       AND e.next_attempt_at <= clock_timestamp()
       AND e.attempts < e.max_attempts
     ORDER BY e.created_at, e.id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
     FOR UPDATE OF e SKIP LOCKED
  LOOP
    UPDATE public.outbox_events e
       SET status = 'processing', attempts = e.attempts + 1,
           locked_at = clock_timestamp(), locked_by = 'operational_receipt_pg_cron'
     WHERE e.id = v_event.id;
    BEGIN
      -- Always use the persisted payment and tenant, never only event metadata.
      v_payment_id := NULLIF(v_event.payload->>'pagamento_id', '')::uuid;
      IF v_payment_id IS NULL THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_ID_REQUIRED';
      END IF;

      SELECT p.* INTO v_payment FROM public.pagamentos p
       WHERE p.id = v_payment_id FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_NOT_FOUND';
      END IF;
      IF v_payment.escola_id IS DISTINCT FROM v_event.escola_id THEN
        RAISE EXCEPTION 'RECEIPT_TENANT_MISMATCH';
      END IF;
      v_monthly_id := NULLIF(v_event.payload->>'mensalidade_id', '')::uuid;
      IF v_payment.mensalidade_id IS DISTINCT FROM v_monthly_id THEN
        RAISE EXCEPTION 'RECEIPT_MONTHLY_ID_MISMATCH';
      END IF;
      IF v_payment.status = 'voided' THEN
        UPDATE public.outbox_events
           SET status = 'dead', last_error = 'RECEIPT_PAYMENT_VOIDED',
               locked_at = NULL, locked_by = NULL,
               next_attempt_at = clock_timestamp()
         WHERE id = v_event.id;
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;
      IF v_payment.status NOT IN ('settled','concluido') THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_NOT_SETTLED:%', v_payment.status;
      END IF;
      -- Intermediate items have one consolidated receipt issued by checkout.
      IF v_payment.meta->'emitir_recibo' = 'false'::jsonb THEN
        UPDATE public.outbox_events
           SET status = 'sent', processed_at = clock_timestamp(),
               last_error = NULL, locked_at = NULL, locked_by = NULL,
               next_attempt_at = clock_timestamp()
         WHERE id = v_event.id;
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;

      IF nullif(v_payment.meta->>'batch_idempotency_key','') IS NOT NULL THEN
        v_rpc := internal.issue_operational_batch_receipt(v_payment.id,NULL);
        IF coalesce(v_rpc->>'ok','false') <> 'true' THEN RAISE EXCEPTION 'RECEIPT_BATCH_ISSUE_FAILED'; END IF;
        UPDATE public.outbox_events SET status='sent',processed_at=clock_timestamp(),
          last_error=NULL,next_attempt_at=clock_timestamp(),locked_at=NULL,locked_by=NULL
        WHERE id=v_event.id;
        issued_count := issued_count+1;
        CONTINUE;
      END IF;

      -- Reconstruct a consolidated receipt from the persisted, validated
      -- checkout items when the synchronous receipt path had failed.
      v_receipt_kind := CASE
        WHEN lower(COALESCE(v_payment.meta->>'tipo_comprovativo','')) LIKE '%confirm%'
          OR lower(COALESCE(v_payment.meta->>'origem','')) LIKE '%rematric%'
        THEN 'confirmacao' ELSE 'pagamento' END;
      IF jsonb_typeof(v_payment.meta->'itens_pagamento') = 'array' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'descricao', COALESCE(NULLIF(btrim(i.item->>'descricao'),''),
                                NULLIF(btrim(i.item->>'nome'),''),'Item'),
          'valor', COALESCE(NULLIF(i.item->>'valor','')::numeric,
                            NULLIF(i.item->>'preco','')::numeric,0)) ORDER BY i.ord),'[]'::jsonb),
          COALESCE(sum(COALESCE(NULLIF(i.item->>'valor','')::numeric,
                                NULLIF(i.item->>'preco','')::numeric,0)),0)
        INTO v_items,v_total
        FROM jsonb_array_elements(v_payment.meta->'itens_pagamento') WITH ORDINALITY i(item,ord);
      ELSIF jsonb_typeof(v_payment.meta->'itens') = 'array' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'descricao', COALESCE(NULLIF(btrim(i.item->>'nome'),''),
                                NULLIF(btrim(i.item->>'descricao'),''),'Item'),
          'valor', COALESCE(NULLIF(i.item->>'preco','')::numeric,
                            NULLIF(i.item->>'valor','')::numeric,0)) ORDER BY i.ord),'[]'::jsonb),
          COALESCE(sum(COALESCE(NULLIF(i.item->>'preco','')::numeric,
                                NULLIF(i.item->>'valor','')::numeric,0)),0)
        INTO v_items,v_total
        FROM jsonb_array_elements(v_payment.meta->'itens') WITH ORDINALITY i(item,ord);
      ELSE
        v_items := jsonb_build_array(jsonb_build_object(
          'descricao',COALESCE(v_payment.meta->>'descricao_item','Serviço escolar'),
          'valor',v_payment.valor_pago));
        v_total := v_payment.valor_pago;
      END IF;
      IF v_items = '[]'::jsonb THEN
        RAISE EXCEPTION 'RECEIPT_EMPTY_CHECKOUT_ITEMS';
      END IF;

      IF v_payment.mensalidade_id IS NOT NULL THEN
        SELECT m.* INTO v_monthly FROM public.mensalidades m
         WHERE m.id = v_payment.mensalidade_id;
        IF NOT FOUND OR v_monthly.escola_id IS DISTINCT FROM v_payment.escola_id
          OR v_monthly.aluno_id IS DISTINCT FROM v_payment.aluno_id THEN
          RAISE EXCEPTION 'RECEIPT_MONTHLY_SCOPE_MISMATCH';
        END IF;
        v_rpc := public.emitir_recibo_system(v_monthly.id);
        IF COALESCE(v_rpc->>'ok','false') <> 'true' THEN
          RAISE EXCEPTION 'RECEIPT_MONTHLY_RPC_REJECTED:%', COALESCE(v_rpc->>'erro','unknown');
        END IF;
        -- Exactly the synchronous batch contract: one receipt for the final
        -- item describing ALL items, not just the final mensalidade.
        IF jsonb_array_length(v_items) > 1 THEN
          v_document_id := NULLIF(v_rpc->>'doc_id','')::uuid;
          IF v_document_id IS NULL THEN
            RAISE EXCEPTION 'RECEIPT_MONTHLY_RPC_MISSING_DOCUMENT';
          END IF;
          UPDATE public.documentos_emitidos d
             SET dados_snapshot = d.dados_snapshot || jsonb_build_object(
               'itens_pagamento',v_items, 'valor_pago',v_total,
               'tipo_comprovativo',v_receipt_kind)
           WHERE d.id=v_document_id AND d.escola_id=v_payment.escola_id
             AND d.aluno_id=v_payment.aluno_id AND d.mensalidade_id=v_monthly.id
             AND d.tipo='recibo' AND NOT (d.dados_snapshot ? 'itens_pagamento');
        END IF;
      ELSE
        -- A service receipt is unique by school and settled payment.
        IF v_payment.aluno_id IS NULL OR v_payment.valor_pago <= 0 THEN
          RAISE EXCEPTION 'RECEIPT_SERVICE_INVALID_PAYMENT';
        END IF;
        SELECT a.nome, a.bi_numero INTO v_aluno_nome, v_aluno_bi
          FROM public.alunos a
         WHERE a.id = v_payment.aluno_id AND a.escola_id = v_payment.escola_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'RECEIPT_SERVICE_STUDENT_SCOPE_MISMATCH';
        END IF;

        v_key := 'pagamento_recibo:' || v_payment.id::text;
        SELECT d.id INTO v_document_id FROM public.documentos_emitidos d
         WHERE d.escola_id = v_payment.escola_id AND d.tipo = 'recibo'
           AND (d.idempotency_key = v_key
                OR d.dados_snapshot->>'pagamento_id' = v_payment.id::text)
         LIMIT 1;
        IF v_document_id IS NULL THEN
          v_fingerprint := encode(sha256(convert_to(
            'pagamento_recibo:v1:' || v_payment.escola_id::text || ':' || v_payment.id::text,
            'UTF8')), 'hex');
          v_hash := encode(sha256(convert_to(
            v_payment.id::text || ':' || clock_timestamp()::text, 'UTF8')), 'hex');
          v_numero := public.next_documento_numero(v_payment.escola_id);
          INSERT INTO public.documentos_emitidos (
            escola_id, aluno_id, mensalidade_id, numero_sequencial,
            tipo, idempotency_key, idempotency_fingerprint,
            dados_snapshot, created_by, hash_validacao
          ) VALUES (
            v_payment.escola_id, v_payment.aluno_id, NULL, v_numero,
            'recibo', v_key, v_fingerprint,
            jsonb_build_object(
              'origem', 'pagamento_auto',
              'pagamento_id', v_payment.id,
              'aluno_id', v_payment.aluno_id,
              'aluno_nome', v_aluno_nome,
              'aluno_bi', v_aluno_bi,
              'numero_sequencial', v_numero,
              'tipo_comprovativo', v_receipt_kind,
              'itens_pagamento', v_items,
              -- Consolidated checkout receipt must match all settled lines.
              'valor_pago', v_total,
              'data_pagamento', v_payment.data_pagamento,
              'metodo', v_payment.metodo,
              'reference', v_payment.reference,
              'hash_validacao', v_hash
            ), NULL, v_hash
          );
        END IF;
      END IF;

      UPDATE public.outbox_events
         SET status = 'sent', processed_at = clock_timestamp(),
             last_error = NULL, next_attempt_at = clock_timestamp(),
             locked_at = NULL, locked_by = NULL
       WHERE id = v_event.id;
      issued_count := issued_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error := left(SQLSTATE || ':' || SQLERRM, 900);
      UPDATE public.outbox_events e
         SET status = CASE WHEN e.attempts >= e.max_attempts
                           THEN 'dead'::public.outbox_status
                           ELSE 'failed'::public.outbox_status END,
             last_error = v_error,
             processed_at = NULL,
             next_attempt_at = clock_timestamp()
               + (interval '1 minute' * LEAST(60, power(2, GREATEST(e.attempts, 1))::integer)),
             locked_at = NULL, locked_by = NULL
       WHERE id = v_event.id;
      failed_count := failed_count + 1;
    END;
  END LOOP;
  RETURN NEXT;
END;
$function$;
