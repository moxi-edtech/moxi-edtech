BEGIN;

-- Emissão individual: uma solicitação por aluno / matrícula / serviço.
-- A liquidação é aferida no ledger financeiro, nunca no JSON do cliente.
CREATE UNIQUE INDEX IF NOT EXISTS ux_documento_individual_pedido_aberto
ON public.servico_pedidos (escola_id, aluno_id, matricula_id, servico_codigo)
WHERE contexto->>'origem' = 'documentos_emissao_individual'
  AND status IN ('pending_payment', 'granted', 'blocked');

CREATE OR REPLACE FUNCTION public.documento_individual_acesso(
  p_escola_id uuid, p_aluno_id uuid, p_session_id uuid, p_tipo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_codigo text;
  v_serv public.servicos_escola%ROWTYPE;
  v_matricula uuid;
  v_pedido public.servico_pedidos%ROWTYPE;
  v_intent public.pagamento_intents%ROWTYPE;
  v_pago boolean := false;
  v_exige_pagamento boolean;
BEGIN
  IF v_actor IS NULL
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id, ARRAY[
       'secretaria','secretaria_financeiro','admin_financeiro','admin_secretario',
       'admin','admin_escola','staff_admin','diretor'
     ]::text[]) THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: acesso à emissão individual negado'
      USING ERRCODE = '42501';
  END IF;

  v_codigo := CASE p_tipo
    WHEN 'declaracao_frequencia' THEN 'DOC_DECLARACAO_FREQUENCIA'
    WHEN 'declaracao_notas' THEN 'DOC_DECLARACAO_NOTAS'
    WHEN 'boletim_trimestral' THEN 'DOC_BOLETIM_TRIMESTRAL'
    WHEN 'cartao_estudante' THEN 'DOC_CARTAO_ESTUDANTE'
    WHEN 'ficha_inscricao' THEN 'DOC_FICHA_INSCRICAO'
    WHEN 'comprovante_matricula' THEN 'DOC_COMPROVANTE_MATRICULA'
    WHEN 'historico' THEN 'DOC_HISTORICO_ESCOLAR'
    WHEN 'certificado' THEN 'DOC_CERTIFICADO_HABILITACOES'
    ELSE NULL
  END;
  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'DOCUMENT_TYPE_INVALID');
  END IF;

  SELECT id INTO v_matricula
  FROM public.matriculas
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id
    AND session_id = p_session_id
    AND status IN ('ativa','ativo','matriculado','concluido','reprovado','transferido','trancado')
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_matricula IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'MATRICULA_NAO_ENCONTRADA');
  END IF;

  SELECT * INTO v_serv
  FROM public.servicos_escola
  WHERE escola_id = p_escola_id AND codigo = v_codigo AND ativo IS TRUE
  LIMIT 1;
  IF v_serv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'SERVICO_NAO_CONFIGURADO');
  END IF;

  v_exige_pagamento := coalesce(v_serv.valor_base,0) > 0
    OR coalesce(v_serv.exige_pagamento_antes_de_liberar, false)
    OR p_tipo IN ('declaracao_notas', 'boletim_trimestral');

  IF v_exige_pagamento AND coalesce(v_serv.valor_base,0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'TAXA_NAO_CONFIGURADA');
  END IF;

  -- Só um pagamento do serviço EXATO e da matrícula do ano escolhido é elegível.
  SELECT * INTO v_pedido
  FROM public.servico_pedidos
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id
    AND matricula_id = v_matricula AND servico_codigo = v_codigo
    AND status IN ('granted','pending_payment','blocked')
  ORDER BY CASE WHEN contexto->>'origem' = 'documentos_emissao_individual' THEN 0 ELSE 1 END,
           created_at DESC, id DESC
  LIMIT 1;

  IF v_pedido.id IS NOT NULL THEN
    SELECT * INTO v_intent
    FROM public.pagamento_intents
    WHERE escola_id = p_escola_id
      AND aluno_id = p_aluno_id
      AND servico_pedido_id = v_pedido.id
    ORDER BY created_at DESC, id DESC LIMIT 1;

    IF v_intent.id IS NOT NULL AND v_pedido.status = 'granted'
       AND v_intent.amount >= v_pedido.valor_cobrado
       AND v_pedido.valor_cobrado >= v_serv.valor_base
       AND (
         -- Novo fluxo: exige liquidação real ligada à intenção exata.
         (v_pedido.contexto->>'origem' = 'documentos_emissao_individual'
           AND EXISTS (
             SELECT 1 FROM public.pagamentos pg
             WHERE pg.escola_id = p_escola_id AND pg.aluno_id = p_aluno_id
               AND pg.status = 'settled' AND pg.valor_pago >= v_pedido.valor_cobrado
               AND pg.meta->>'pagamento_intent_id' = v_intent.id::text
               AND pg.meta->>'pedido_id' = v_pedido.id::text
           ))
         OR
         -- Pedidos existentes continuam válidos quando a própria intenção foi
         -- efetivamente liquidada pelo sistema legado.
         (v_pedido.contexto->>'origem' IS DISTINCT FROM 'documentos_emissao_individual'
           AND v_intent.status = 'settled')
       ) THEN
      v_pago := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE
      WHEN v_exige_pagamento AND v_pago THEN 'paid'
      WHEN v_exige_pagamento AND v_intent.id IS NOT NULL AND v_intent.status = 'pending' THEN 'verification'
      WHEN v_exige_pagamento THEN 'pending_payment'
      WHEN v_serv.exige_aprovacao AND v_pedido.status IS DISTINCT FROM 'granted' THEN 'approval'
      ELSE 'free'
    END,
    'granted', CASE
      WHEN v_exige_pagamento THEN v_pago
      WHEN v_serv.exige_aprovacao THEN v_pedido.status = 'granted'
      ELSE true
    END,
    'valor', v_serv.valor_base,
    'servico_codigo', v_codigo,
    'matricula_id', v_matricula,
    'pedido_id', v_pedido.id,
    'pagamento_intent_id', v_intent.id,
    'pagamento_obrigatorio', v_exige_pagamento
  );
END;
$$;

REVOKE ALL ON FUNCTION public.documento_individual_acesso(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.documento_individual_acesso(uuid,uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.documento_individual_solicitar(
  p_escola_id uuid, p_aluno_id uuid, p_session_id uuid, p_tipo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_access jsonb;
  v_serv public.servicos_escola%ROWTYPE;
  v_pedido public.servico_pedidos%ROWTYPE;
  v_intent uuid;
  v_matricula uuid;
BEGIN
  v_access := public.documento_individual_acesso(p_escola_id,p_aluno_id,p_session_id,p_tipo);
  IF coalesce((v_access->>'ok')::boolean,false) IS NOT TRUE THEN
    RETURN v_access;
  END IF;
  IF (v_access->>'granted')::boolean THEN
    RETURN v_access;
  END IF;

  v_matricula := (v_access->>'matricula_id')::uuid;
  SELECT * INTO v_serv FROM public.servicos_escola
   WHERE escola_id=p_escola_id AND codigo=v_access->>'servico_codigo' AND ativo IS TRUE;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('documento_individual:' || p_escola_id::text || ':'
      || p_aluno_id::text || ':' || p_session_id::text || ':' || v_serv.codigo, 0)
  );

  SELECT * INTO v_pedido FROM public.servico_pedidos
  WHERE escola_id=p_escola_id AND aluno_id=p_aluno_id AND matricula_id=v_matricula
    AND servico_codigo=v_serv.codigo
    AND status IN ('pending_payment','granted','blocked')
  ORDER BY CASE WHEN contexto->>'origem' = 'documentos_emissao_individual' THEN 0 ELSE 1 END,
           created_at DESC, id DESC LIMIT 1;

  IF v_pedido.id IS NULL THEN
    INSERT INTO public.servico_pedidos (
      escola_id,aluno_id,matricula_id,servico_escola_id,status,servico_codigo,
      servico_nome,valor_cobrado,contexto,created_by
    ) VALUES (
      p_escola_id,p_aluno_id,v_matricula,v_serv.id,
      CASE WHEN v_serv.valor_base > 0 THEN 'pending_payment' ELSE 'blocked' END,
      v_serv.codigo,v_serv.nome,v_serv.valor_base,
      jsonb_build_object('origem','documentos_emissao_individual','ano_letivo_id',p_session_id,
        'tipo_documento',p_tipo),v_actor
    ) RETURNING * INTO v_pedido;
  END IF;

  IF v_serv.valor_base > 0 THEN
    SELECT id INTO v_intent FROM public.pagamento_intents
    WHERE escola_id=p_escola_id AND aluno_id=p_aluno_id AND servico_pedido_id=v_pedido.id
      AND status NOT IN ('canceled','failed')
    ORDER BY created_at DESC LIMIT 1;
    IF v_intent IS NULL THEN
      INSERT INTO public.pagamento_intents (
        escola_id,aluno_id,servico_pedido_id,amount,method,status,currency,created_by
      ) VALUES (
        p_escola_id,p_aluno_id,v_pedido.id,v_pedido.valor_cobrado,'cash','draft','AOA',v_actor
      ) RETURNING id INTO v_intent;
    END IF;
  END IF;
  RETURN public.documento_individual_acesso(p_escola_id,p_aluno_id,p_session_id,p_tipo);
END;
$$;

REVOKE ALL ON FUNCTION public.documento_individual_solicitar(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.documento_individual_solicitar(uuid,uuid,uuid,text) TO authenticated, service_role;

-- O endpoint passa a usar obrigatoriamente a sessão exata. A RPC antiga de 5
-- parâmetros não é um ponto de entrada público para contornar o pagamento.
CREATE OR REPLACE FUNCTION public.emitir_documento_final_individual(
  p_escola_id uuid, p_aluno_id uuid, p_ano_letivo integer,
  p_session_id uuid, p_tipo_documento text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_access jsonb;
  v_ano integer;
BEGIN
  SELECT ano INTO v_ano FROM public.anos_letivos
  WHERE id = p_session_id AND escola_id = p_escola_id LIMIT 1;
  IF v_ano IS NULL OR v_ano <> p_ano_letivo THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_MISMATCH: ano e sessão divergentes'
      USING ERRCODE = '22023';
  END IF;

  v_access := public.documento_individual_acesso(
    p_escola_id,p_aluno_id,p_session_id,p_tipo_documento
  );
  IF coalesce((v_access->>'granted')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'DOCUMENT_PAYMENT_REQUIRED: pagamento ou aprovação pendente'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.emitir_documento_final_idempotente(
    p_escola_id,p_aluno_id,p_ano_letivo,p_tipo_documento,p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_documento_final_individual(uuid,uuid,integer,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_documento_final_individual(uuid,uuid,integer,uuid,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text) TO service_role;

COMMIT;
