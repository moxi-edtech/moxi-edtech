BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_recibo_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE RESTRICT,
  recibo_documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  alocacao_id uuid NOT NULL REFERENCES public.financeiro_pagamento_alocacoes(id) ON DELETE RESTRICT,
  fiscal_documento_origem_id uuid NOT NULL REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  valor_bruto_aoa numeric(18,2) NOT NULL,
  valor_liquido_aoa numeric(18,2) NOT NULL,
  valor_imposto_aoa numeric(18,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_recibo_alocacoes_amount_chk CHECK (
    valor_bruto_aoa > 0
    AND valor_liquido_aoa >= 0
    AND valor_imposto_aoa >= 0
    AND round(valor_liquido_aoa + valor_imposto_aoa,2) = round(valor_bruto_aoa,2)
  ),
  CONSTRAINT financeiro_recibo_alocacoes_alocacao_uk UNIQUE (alocacao_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_recibo_aloc_pagamento
  ON public.financeiro_recibo_alocacoes(pagamento_id,created_at);
CREATE INDEX IF NOT EXISTS idx_fin_recibo_aloc_recibo
  ON public.financeiro_recibo_alocacoes(recibo_documento_id,created_at);

ALTER TABLE public.financeiro_recibo_alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_recibo_alocacoes_select
ON public.financeiro_recibo_alocacoes;
CREATE POLICY financeiro_recibo_alocacoes_select
ON public.financeiro_recibo_alocacoes
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR escola_id = public.current_tenant_escola_id()
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_recibo_alocacoes.escola_id
      AND eu.user_id = auth.uid()
  )
);

REVOKE ALL ON TABLE public.financeiro_recibo_alocacoes
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.financeiro_recibo_alocacoes TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_fin_recibo_aloc_immutable
ON public.financeiro_recibo_alocacoes;
CREATE TRIGGER trg_fin_recibo_aloc_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_recibo_alocacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_block_immutable_row();

CREATE OR REPLACE FUNCTION public.fiscal_emitir_recibo_pagamento(p_pagamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_claim_role text := COALESCE(current_setting('request.jwt.claim.role',true),'');
  v_pagamento public.pagamentos%ROWTYPE;
  v_existing_doc public.fiscal_documentos%ROWTYPE;
  v_empresa_id uuid;
  v_binding_count integer;
  v_serie public.fiscal_series%ROWTYPE;
  v_key public.fiscal_chaves%ROWTYPE;
  v_numero bigint;
  v_numero_formatado text;
  v_hash_anterior text;
  v_canonical text;
  v_hash_control text;
  v_documento_id uuid;
  v_total_gross numeric(18,2);
  v_total_net numeric(18,2);
  v_total_tax numeric(18,2);
  v_source_docs jsonb;
  v_cliente_nome text;
  v_cliente_nif text;
  v_cliente_country text;
  v_source_count integer;
  v_alloc record;
  v_line integer := 0;
  v_payment_mechanism text;
  v_last_authorized bigint;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: emissão de RC financeiro é exclusiva do backend';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.status NOT IN ('settled','concluido','pago') THEN
    RAISE EXCEPTION 'STATE: pagamento precisa estar liquidado para emitir RC';
  END IF;

  SELECT d.*
    INTO v_existing_doc
  FROM public.financeiro_recibo_alocacoes ra
  JOIN public.fiscal_documentos d ON d.id=ra.recibo_documento_id
  WHERE ra.pagamento_id=v_pagamento.id
  ORDER BY ra.created_at
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'documento_id',v_existing_doc.id,
      'empresa_id',v_existing_doc.empresa_id,
      'numero',v_existing_doc.numero,
      'numero_formatado',v_existing_doc.numero_formatado,
      'hash_control',v_existing_doc.hash_control,
      'key_version',v_existing_doc.key_version,
      'status',v_existing_doc.status,
      'canonical_string',v_existing_doc.canonical_string
    );
  END IF;

  SELECT count(*)
    INTO v_source_count
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND a.fiscal_documento_origem_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id
        AND r.natureza='reversao'
    );

  IF v_source_count = 0 THEN
    RAISE EXCEPTION 'STATE: pagamento não possui documento fiscal origem; fluxo correcto é FR, não RC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_pagamento_alocacoes a
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id
          AND r.natureza='reversao'
      )
      AND (
        a.fiscal_documento_origem_id IS NULL
        OR a.valor_liquido_aoa IS NULL
        OR a.valor_imposto_aoa IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'STATE: pagamento possui alocações sem referência fiscal; RC não pode ser emitido';
  END IF;

  SELECT
    min(d.empresa_id),
    count(DISTINCT d.empresa_id),
    min(d.cliente_nome),
    min(d.cliente_nif),
    count(DISTINCT COALESCE(d.cliente_nif,''))
  INTO
    v_empresa_id,
    v_binding_count,
    v_cliente_nome,
    v_cliente_nif,
    v_source_count
  FROM public.financeiro_pagamento_alocacoes a
  JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'STATE: documentos origem do pagamento pertencem a empresas fiscais diferentes';
  END IF;

  IF v_source_count <> 1 THEN
    RAISE EXCEPTION 'STATE: documentos origem do pagamento possuem clientes fiscais diferentes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_pagamento_alocacoes a
    JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
      )
      AND (
        d.tipo_documento NOT IN ('FT','ND')
        OR d.status <> 'emitido'
        OR d.moeda <> 'AOA'
      )
  ) THEN
    RAISE EXCEPTION 'STATE: RC requer documentos origem FT/ND emitidos em AOA';
  END IF;

  SELECT count(*)
    INTO v_binding_count
  FROM public.fiscal_escola_bindings b
  WHERE b.escola_id=v_pagamento.escola_id
    AND b.empresa_id=v_empresa_id
    AND b.effective_from <= CURRENT_DATE
    AND (b.effective_to IS NULL OR b.effective_to >= CURRENT_DATE);

  IF v_binding_count = 0 THEN
    RAISE EXCEPTION 'AUTH: empresa fiscal dos documentos origem não está vinculada à escola';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM CURRENT_DATE)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL
  ORDER BY agt_provisioned_at DESC
  LIMIT 2;

  GET DIAGNOSTICS v_binding_count = ROW_COUNT;

  IF v_binding_count = 0 THEN
    RAISE EXCEPTION 'STATE: série RC provisionada pela AGT não encontrada';
  END IF;

  SELECT count(*)
    INTO v_binding_count
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM CURRENT_DATE)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL;

  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'STATE: é necessária exactamente uma série RC AGT activa para o ano corrente';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM CURRENT_DATE)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL
  FOR UPDATE;

  IF v_serie.last_document_no IS NULL OR v_serie.agt_series_code IS NULL THEN
    RAISE EXCEPTION 'STATE: série RC AGT sem intervalo autorizado';
  END IF;

  BEGIN
    v_last_authorized := v_serie.last_document_no::bigint;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'STATE: limite final da série RC AGT não é numérico';
  END;

  IF v_serie.ultimo_numero >= v_last_authorized THEN
    RAISE EXCEPTION 'STATE: intervalo da série RC AGT esgotado';
  END IF;

  UPDATE public.fiscal_series
  SET ultimo_numero=ultimo_numero+1,
      updated_at=now()
  WHERE id=v_serie.id
  RETURNING ultimo_numero INTO v_numero;

  v_numero_formatado := format(
    'RC %s/%s',
    trim(v_serie.agt_series_code),
    v_numero::text
  );

  SELECT *
    INTO v_key
  FROM public.fiscal_chaves
  WHERE empresa_id=v_empresa_id
    AND status='active'
  ORDER BY key_version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATE: chave fiscal activa não encontrada';
  END IF;

  SELECT
    round(sum(a.valor_bruto_aoa),2),
    round(sum(a.valor_liquido_aoa),2),
    round(sum(a.valor_imposto_aoa),2)
  INTO v_total_gross,v_total_net,v_total_tax
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  v_source_docs := '[]'::jsonb;

  FOR v_alloc IN
    SELECT
      a.id alocacao_id,
      a.valor_liquido_aoa,
      a.valor_imposto_aoa,
      a.valor_bruto_aoa,
      d.id source_id,
      d.numero_formatado,
      d.invoice_date,
      d.payload
    FROM public.financeiro_pagamento_alocacoes a
    JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
      )
    ORDER BY a.created_at,a.id
  LOOP
    v_line := v_line + 1;
    v_source_docs := v_source_docs || jsonb_build_array(
      jsonb_build_object(
        'lineNo',v_line,
        'sourceDocumentID',jsonb_build_object(
          'OriginatingON',v_alloc.numero_formatado,
          'documentDate',v_alloc.invoice_date
        ),
        'creditAmount',v_alloc.valor_liquido_aoa,
        'allocationId',v_alloc.alocacao_id
      )
    );

    IF v_line=1 THEN
      v_cliente_country := upper(
        COALESCE(NULLIF(v_alloc.payload->'cliente'->>'country',''),'AO')
      );
    END IF;
  END LOOP;

  IF v_cliente_country !~ '^[A-Z]{2}$' THEN
    v_cliente_country := 'AO';
  END IF;

  v_payment_mechanism := CASE v_pagamento.metodo::text
    WHEN 'cash' THEN 'NU'
    WHEN 'transfer' THEN 'TB'
    WHEN 'tpa' THEN 'MB'
    WHEN 'mcx' THEN 'MB'
    WHEN 'kwik' THEN 'MB'
    ELSE NULL
  END;

  SELECT hash_control
    INTO v_hash_anterior
  FROM public.fiscal_documentos
  WHERE serie_id=v_serie.id
  ORDER BY numero DESC
  LIMIT 1;

  v_canonical := jsonb_build_object(
    'empresa_id',v_empresa_id,
    'serie_id',v_serie.id,
    'numero',v_numero,
    'numero_formatado',v_numero_formatado,
    'tipo_documento','RC',
    'invoice_date',CURRENT_DATE,
    'moeda','AOA',
    'payment_mechanism',v_payment_mechanism,
    'total_bruto_aoa',v_total_gross,
    'total_impostos_aoa',v_total_tax,
    'total_liquido_aoa',v_total_net,
    'hash_anterior',v_hash_anterior,
    'cliente_nome',v_cliente_nome,
    'cliente_nif',v_cliente_nif,
    'sourceDocuments',v_source_docs
  )::text;

  v_hash_control := encode(extensions.digest(v_canonical,'sha256'),'hex');

  INSERT INTO public.fiscal_documentos (
    empresa_id,serie_id,tipo_documento,numero,numero_formatado,
    cliente_nome,cliente_nif,invoice_date,moeda,taxa_cambio_aoa,
    payment_mechanism,total_bruto_aoa,total_impostos_aoa,total_liquido_aoa,
    hash_anterior,assinatura_base64,hash_control,canonical_string,key_version,
    status,documento_origem_id,rectifica_documento_id,payload,created_by
  )
  VALUES (
    v_empresa_id,v_serie.id,'RC',v_numero,v_numero_formatado,
    COALESCE(v_cliente_nome,'Consumidor final'),
    COALESCE(v_cliente_nif,'999999999'),
    CURRENT_DATE,'AOA',NULL,
    v_payment_mechanism,v_total_gross,v_total_tax,v_total_net,
    v_hash_anterior,NULL,v_hash_control,v_canonical,v_key.key_version,
    'pendente_assinatura',NULL,NULL,
    jsonb_build_object(
      'cliente',jsonb_build_object(
        'nome',COALESCE(v_cliente_nome,'Consumidor final'),
        'nif',COALESCE(v_cliente_nif,'999999999'),
        'country',v_cliente_country
      ),
      'paymentReceipt',jsonb_build_object(
        'sourceDocuments',v_source_docs
      ),
      'metadata',jsonb_build_object(
        'origem_integracao','financeiro_pagamento_rc_v1',
        'origem_operacao','financeiro_pagamento_rc',
        'origem_id',v_pagamento.id::text,
        'pagamento_id',v_pagamento.id,
        'payment_mechanism_local',v_payment_mechanism,
        'allocation_model','proportional_residual_v1'
      )
    ),
    COALESCE(v_pagamento.settled_by,v_pagamento.created_by)
  )
  RETURNING id INTO v_documento_id;

  INSERT INTO public.financeiro_recibo_alocacoes (
    escola_id,pagamento_id,recibo_documento_id,alocacao_id,
    fiscal_documento_origem_id,valor_bruto_aoa,valor_liquido_aoa,valor_imposto_aoa
  )
  SELECT
    v_pagamento.escola_id,
    v_pagamento.id,
    v_documento_id,
    a.id,
    a.fiscal_documento_origem_id,
    a.valor_bruto_aoa,
    a.valor_liquido_aoa,
    a.valor_imposto_aoa
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND a.fiscal_documento_origem_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  INSERT INTO public.financeiro_fiscal_links (
    escola_id,empresa_id,origem_tipo,origem_id,fiscal_documento_id,
    status,idempotency_key,payload_snapshot,fiscal_error
  )
  VALUES (
    v_pagamento.escola_id,v_empresa_id,'financeiro_pagamento_rc',
    v_pagamento.id::text,v_documento_id,'pending',
    format('financeiro_pagamento_rc:%s',v_pagamento.id),
    jsonb_build_object(
      'pagamento_id',v_pagamento.id,
      'sourceDocuments',v_source_docs,
      'total_bruto_aoa',v_total_gross,
      'total_liquido_aoa',v_total_net,
      'total_impostos_aoa',v_total_tax
    ),
    NULL
  )
  ON CONFLICT (origem_tipo,origem_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'documento_id',v_documento_id,
    'empresa_id',v_empresa_id,
    'numero',v_numero,
    'numero_formatado',v_numero_formatado,
    'hash_control',v_hash_control,
    'key_version',v_key.key_version,
    'status','pendente_assinatura',
    'canonical_string',v_canonical,
    'total_bruto_aoa',v_total_gross,
    'total_liquido_aoa',v_total_net,
    'total_impostos_aoa',v_total_tax,
    'source_documents',v_source_docs
  );
END;
$function$


REVOKE EXECUTE ON FUNCTION public.fiscal_emitir_recibo_pagamento(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_emitir_recibo_pagamento(uuid)
TO service_role;

COMMIT;