BEGIN;

-- Honor explicit zero-price declaration configuration; retain the separate paid boletim contract.
-- Preserve SECURITY DEFINER authorization and exact tenant, enrollment and ledger checks.
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
  v_ano integer;
  v_historico uuid;
  v_status_historico text;
  v_total_notas integer;
  v_invalidas integer;
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

  -- A validação precede a criação de pedidos ou cobranças. Ao contrário do
  -- simples fecho, exige notas por disciplina com valores válidos (zero conta).
  -- Nunca usar pautas de outra escola, matrícula ou ano.
  IF p_tipo = 'certificado' THEN
    SELECT ano INTO v_ano FROM public.anos_letivos
    WHERE id = p_session_id AND escola_id = p_escola_id;
    SELECT id, snapshot_status INTO v_historico, v_status_historico
    FROM public.historico_anos
    WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND ano_letivo = v_ano
    LIMIT 1;
    IF v_historico IS NULL THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','HISTORICO_INEXISTENTE');
    END IF;
    IF v_status_historico IS DISTINCT FROM 'fechado' THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','HISTORICO_ABERTO');
    END IF;
    SELECT count(*), count(*) FILTER (WHERE
      (nota_final IS NULL AND media_final IS NULL)
      OR coalesce(nota_final,media_final) NOT BETWEEN 0 AND 20
      OR nullif(btrim(disciplina_nome),'') IS NULL
    ) INTO v_total_notas, v_invalidas
    FROM public.historico_disciplinas WHERE historico_ano_id = v_historico;
    IF v_total_notas = 0 THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','NOTAS_INEXISTENTES');
    END IF;
    IF v_invalidas > 0 THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','NOTAS_INCOMPLETAS');
    END IF;
  END IF;

  v_exige_pagamento := coalesce(v_serv.valor_base,0) > 0
    OR coalesce(v_serv.exige_pagamento_antes_de_liberar, false)
    OR p_tipo = 'boletim_trimestral';

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
      WHEN v_serv.exige_aprovacao THEN coalesce(v_pedido.status = 'granted', false)
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

COMMIT;
