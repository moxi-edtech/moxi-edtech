-- Executar após a migração 20271203002000 em DB PostgreSQL 17 descartável.
BEGIN;

INSERT INTO public.escolas(id,nome,status) VALUES
 ('00000000-0000-4000-8000-000000007001','Escola Documentos A','ativa'),
 ('00000000-0000-4000-8000-000000007002','Escola Documentos B','ativa');
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000007003','secretaria@documentos-klasse.test'),
 ('00000000-0000-4000-8000-000000007004','professor@documentos-klasse.test');
INSERT INTO public.escola_users(escola_id,user_id,role,papel) VALUES
 ('00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007003','staff','secretaria'),
 ('00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007004','staff','professor');
INSERT INTO public.alunos(id,escola_id,nome) VALUES
 ('00000000-0000-4000-8000-000000007005','00000000-0000-4000-8000-000000007001','Aluno Documentos');
INSERT INTO public.alunos(id,escola_id,nome) VALUES
 ('00000000-0000-4000-8000-000000007014','00000000-0000-4000-8000-000000007001','Aluno com Notas Incompletas');
INSERT INTO public.anos_letivos(id,escola_id,ano) VALUES
 ('00000000-0000-4000-8000-000000007006','00000000-0000-4000-8000-000000007001',2026),
 ('00000000-0000-4000-8000-000000007007','00000000-0000-4000-8000-000000007001',2025);
INSERT INTO public.matriculas(id,escola_id,aluno_id,session_id,status) VALUES
 ('00000000-0000-4000-8000-000000007008','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005','00000000-0000-4000-8000-000000007006','ativa'),
 ('00000000-0000-4000-8000-000000007009','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005','00000000-0000-4000-8000-000000007007','concluido'),
 ('00000000-0000-4000-8000-000000007015','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007014','00000000-0000-4000-8000-000000007006','concluido');

INSERT INTO public.historico_anos(id,escola_id,aluno_id,ano_letivo,matricula_id,snapshot_status) VALUES
 ('00000000-0000-4000-8000-000000007010','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',2026,'00000000-0000-4000-8000-000000007008','fechado'),
 ('00000000-0000-4000-8000-000000007011','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',2025,'00000000-0000-4000-8000-000000007009','fechado'),
 ('00000000-0000-4000-8000-000000007016','00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007014',2026,'00000000-0000-4000-8000-000000007015','fechado');
INSERT INTO public.historico_disciplinas(id,historico_ano_id,disciplina_nome,nota_final) VALUES
 ('00000000-0000-4000-8000-000000007012','00000000-0000-4000-8000-000000007010','Matemática',0),
 ('00000000-0000-4000-8000-000000007013','00000000-0000-4000-8000-000000007010','Língua Portuguesa',15),
 ('00000000-0000-4000-8000-000000007017','00000000-0000-4000-8000-000000007016','Matemática',NULL);

INSERT INTO public.servicos_escola(escola_id,codigo,nome,valor_base) VALUES
 ('00000000-0000-4000-8000-000000007001','DOC_CERTIFICADO_HABILITACOES','Certificado',2500),
 ('00000000-0000-4000-8000-000000007001','DOC_HISTORICO_ESCOLAR','Histórico',3000),
 ('00000000-0000-4000-8000-000000007001','DOC_DECLARACAO_NOTAS','Declaração com Notas',0),
 ('00000000-0000-4000-8000-000000007001','DOC_FICHA_INSCRICAO','Ficha de Inscrição',0);

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_one jsonb;
  v_two jsonb;
  v_free jsonb;
  v_notes jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object(
    'sub','00000000-0000-4000-8000-000000007003',
    'role','authenticated','escola_id','00000000-0000-4000-8000-000000007001'
  )::text,true);

  v_free := public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','ficha_inscricao');
  IF v_free->>'status' IS DISTINCT FROM 'free' OR (v_free->>'granted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FREE_DOCUMENT_BLOCKED: %',v_free;
  END IF;

  v_notes := public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','declaracao_notas');
  IF v_notes->>'reason' IS DISTINCT FROM 'TAXA_NAO_CONFIGURADA' THEN
    RAISE EXCEPTION 'UNPRICED_NOTES_ALLOWED: %',v_notes;
  END IF;

  -- Um histórico fechado, mas vazio, não deve permitir criar uma cobrança.
  IF (public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007007','certificado')->>'reason')
    IS DISTINCT FROM 'NOTAS_INEXISTENTES' THEN
    RAISE EXCEPTION 'EMPTY_HISTORICAL_CERTIFICATE_ACCEPTED';
  END IF;

  -- A nota zero é legítima na matrícula principal; outra matrícula tem
  -- classificação NULL e não pode solicitar ou pagar um certificado.
  IF (public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007014',
    '00000000-0000-4000-8000-000000007006','certificado')->>'reason')
    IS DISTINCT FROM 'NOTAS_INCOMPLETAS' THEN
    RAISE EXCEPTION 'PARTIALLY_GRADED_CERTIFICATE_ACCEPTED';
  END IF;

  v_one := public.documento_individual_solicitar(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','certificado');
  v_two := public.documento_individual_solicitar(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','certificado');
  IF v_one->>'pedido_id' IS DISTINCT FROM v_two->>'pedido_id'
     OR v_one->>'pagamento_intent_id' IS DISTINCT FROM v_two->>'pagamento_intent_id'
     OR v_one->>'status' IS DISTINCT FROM 'pending_payment' THEN
    RAISE EXCEPTION 'DUPLICATE_SERVICE_INTENT: % / %',v_one,v_two;
  END IF;

  BEGIN
    PERFORM public.emitir_documento_final_individual(
      '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
      2026,'00000000-0000-4000-8000-000000007006','certificado','doc-gate-unpaid');
    RAISE EXCEPTION 'UNPAID_DOCUMENT_ISSUED';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.emitir_documento_final_individual(
      '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
      2025,'00000000-0000-4000-8000-000000007006','certificado','doc-year-wrong');
    RAISE EXCEPTION 'WRONG_YEAR_ISSUED';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_pedido uuid;
  v_intent uuid;
  v_access jsonb;
BEGIN
  SELECT id INTO v_pedido FROM public.servico_pedidos
  WHERE servico_codigo='DOC_CERTIFICADO_HABILITACOES'
    AND aluno_id='00000000-0000-4000-8000-000000007005';
  SELECT id INTO v_intent FROM public.pagamento_intents WHERE servico_pedido_id=v_pedido;

  IF (SELECT count(*) FROM public.servico_pedidos WHERE id=v_pedido) <> 1
     OR (SELECT count(*) FROM public.pagamento_intents WHERE servico_pedido_id=v_pedido) <> 1 THEN
    RAISE EXCEPTION 'DUPLICATE_REQUEST';
  END IF;

  -- Simulação de intenção falsamente marcada settled: o ledger não a confirma.
  UPDATE public.pagamento_intents SET status='settled' WHERE id=v_intent;
  UPDATE public.servico_pedidos SET status='granted' WHERE id=v_pedido;
  PERFORM set_config('request.jwt.claims',json_build_object(
    'sub','00000000-0000-4000-8000-000000007003',
    'role','authenticated','escola_id','00000000-0000-4000-8000-000000007001'
  )::text,true);
  v_access := public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','certificado');
  IF (v_access->>'granted')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FORGED_SETTLEMENT_ACCEPTED: %',v_access;
  END IF;

  UPDATE public.pagamento_intents SET status='draft' WHERE id=v_intent;
  UPDATE public.servico_pedidos SET status='pending_payment' WHERE id=v_pedido;

  -- Numerário liquidado: apenas o ledger gera o estado liquidado.
  INSERT INTO public.pagamentos(escola_id,aluno_id,valor_pago,metodo,status,settled_at,meta)
  VALUES (
    '00000000-0000-4000-8000-000000007001',
    '00000000-0000-4000-8000-000000007005',2500,'cash','settled',now(),
    jsonb_build_object('origem','documentos_emissao_individual','pedido_id',v_pedido,
      'pagamento_intent_id',v_intent,'servico_codigo','DOC_CERTIFICADO_HABILITACOES')
  );
  IF (SELECT status FROM public.pagamento_intents WHERE id=v_intent) IS DISTINCT FROM 'settled'
    OR (SELECT status FROM public.servico_pedidos WHERE id=v_pedido) IS DISTINCT FROM 'granted' THEN
    RAISE EXCEPTION 'LEDGER_NOT_SYNCHRONIZED';
  END IF;

  BEGIN
    INSERT INTO public.pagamentos(escola_id,aluno_id,valor_pago,metodo,status,meta)
    VALUES (
      '00000000-0000-4000-8000-000000007001',
      '00000000-0000-4000-8000-000000007005',2500,'cash','pending',
      jsonb_build_object('origem','documentos_emissao_individual','pedido_id',v_pedido,
        'pagamento_intent_id',v_intent,'servico_codigo','DOC_CERTIFICADO_HABILITACOES')
    );
    RAISE EXCEPTION 'DUPLICATE_PAYMENT_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_one jsonb;
  v_two jsonb;
  v_other jsonb;
  v_access jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object(
    'sub','00000000-0000-4000-8000-000000007003',
    'role','authenticated','escola_id','00000000-0000-4000-8000-000000007001'
  )::text,true);
  v_access := public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','certificado');
  IF v_access->>'status' IS DISTINCT FROM 'paid' OR (v_access->>'granted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PAYMENT_NOT_UNLOCKED: %',v_access;
  END IF;

  v_one := public.emitir_documento_final_individual(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    2026,'00000000-0000-4000-8000-000000007006','certificado','doc-paid-one-001');
  v_two := public.emitir_documento_final_individual(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    2026,'00000000-0000-4000-8000-000000007006','certificado','doc-paid-two-002');
  IF v_one->>'docId' IS DISTINCT FROM v_two->>'docId' THEN
    RAISE EXCEPTION 'REPRINT_DUPLICATED_DOCUMENT: % / %',v_one,v_two;
  END IF;

  v_other := public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007007','certificado');
  IF (v_other->>'granted')::boolean IS DISTINCT FROM false
      OR v_other->>'reason' IS DISTINCT FROM 'NOTAS_INEXISTENTES' THEN
    RAISE EXCEPTION 'CROSS_YEAR_OR_EMPTY_HISTORICAL_CERTIFICATE_ACCEPTED: %',v_other;
  END IF;

  -- EXPAND: old application versions keep working until contract migration.
  IF NOT has_function_privilege(
    'authenticated','public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)','EXECUTE'
  ) THEN RAISE EXCEPTION 'LEGACY_WRAPPER_REVOKED_BEFORE_DEPLOY'; END IF;
END;
$$;

DO $$
DECLARE v_denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object(
    'sub','00000000-0000-4000-8000-000000007004',
    'role','authenticated','escola_id','00000000-0000-4000-8000-000000007001'
  )::text,true);
  BEGIN
    PERFORM public.documento_individual_acesso(
      '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
      '00000000-0000-4000-8000-000000007006','certificado');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'PROFESSOR_AUTH_BYPASS'; END IF;
END;
$$;

RESET ROLE;

-- 3 000 Kz no histórico: comprovativo pendente não é liquidação.
DO $$
DECLARE v_pedido uuid; v_intent uuid;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object(
    'sub','00000000-0000-4000-8000-000000007003',
    'role','authenticated','escola_id','00000000-0000-4000-8000-000000007001'
  )::text,true);
  PERFORM public.documento_individual_solicitar(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','historico');
  SELECT id INTO v_pedido FROM public.servico_pedidos WHERE servico_codigo='DOC_HISTORICO_ESCOLAR';
  SELECT id INTO v_intent FROM public.pagamento_intents WHERE servico_pedido_id=v_pedido;
  INSERT INTO public.pagamentos(escola_id,aluno_id,valor_pago,metodo,status,reference,meta)
  VALUES (
    '00000000-0000-4000-8000-000000007001',
    '00000000-0000-4000-8000-000000007005',3000,'tpa','pending','TPA-001',
    jsonb_build_object('origem','documentos_emissao_individual','pedido_id',v_pedido,
      'pagamento_intent_id',v_intent,'servico_codigo','DOC_HISTORICO_ESCOLAR')
  );
  IF (public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','historico')->>'granted')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'TPA_PENDING_UNBLOCKED';
  END IF;
  UPDATE public.pagamentos SET status='settled',settled_at=now()
  WHERE meta->>'pagamento_intent_id'=v_intent::text;
  IF (public.documento_individual_acesso(
    '00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000007005',
    '00000000-0000-4000-8000-000000007006','historico')->>'granted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TPA_SETTLED_NOT_UNLOCKED';
  END IF;
END;
$$;

ROLLBACK;
