-- PR #455 · PostgreSQL 17 real engine / controlled fixture.
\set ON_ERROR_STOP on
DO $$
DECLARE
  y integer := extract(year from current_date - interval '2 months')::int;
  d0 date := date_trunc('month',current_date)::date;
  d1 date := (date_trunc('month',current_date) + interval '1 month')::date;
  d2 date := (date_trunc('month',current_date) + interval '2 months')::date;
  d3 date := (date_trunc('month',current_date) + interval '3 months')::date;
  dp date := (date_trunc('month',current_date) - interval '1 month')::date;
  v_escola1 uuid := '11111111-1111-4111-8111-111111111111';
  v_escola2 uuid := '22222222-2222-4222-8222-222222222222';
  v_aluno1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_aluno2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_aluno3 uuid := '33333333-3333-4333-8333-333333333333';
  v_aluno4 uuid := '34343434-3434-4434-8434-343434343434';
  v_aluno5 uuid := '56565656-5656-4656-8656-565656565656';
  v_mat1 uuid := '55555555-5555-4555-8555-555555555555';
  v_mat2 uuid := '66666666-6666-4666-8666-666666666666';
  v_mat3 uuid := '77777777-7777-4777-8777-777777777777';
  v_mat4 uuid := '45454545-4545-4454-8454-454545454545';
  v_mat5 uuid := '67676767-6767-4676-8676-676767676767';
  v_aluno6 uuid := '86868686-8686-4868-8868-868686868686';
  v_mat6 uuid := '89898989-8989-4898-8898-898989898989';
  v_cand6 uuid := '85858585-8585-4858-8858-858585858585';
  v_turma1 uuid := '88888888-8888-4888-8888-888888888888';
  v_turma2 uuid := '99999999-9999-4999-8999-999999999999';
  v_parcial uuid := '12121212-1212-4212-8212-121212121212';
  v_fiscal uuid := '13131313-1313-4313-8313-131313131313';
  v_inconsistente uuid := '24242424-2424-4424-8424-242424242424';
  v_antiga_parcial uuid := '35353535-3535-4535-8535-353535353535';
  v_actor1 uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_denied uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_result jsonb;
  v_extra jsonb;
  v_val numeric;
  v_count int;
BEGIN
  INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES (v_escola1,v_actor1,'secretaria');
  INSERT INTO public.anos_letivos(id,escola_id,ano,data_inicio,data_fim)
    VALUES
    ('14141414-1414-4414-8414-141414141414',v_escola1,y,dp-interval '1 month',d3+interval '5 months'),
    ('15151515-1515-4515-8515-151515151515',v_escola2,y,dp-interval '1 month',d3+interval '5 months');
  INSERT INTO public.turmas(id,escola_id,curso_id,classe_id) VALUES
    (v_turma1,v_escola1,'16161616-1616-4616-8616-161616161616','17171717-1717-4717-8717-171717171717'),
    (v_turma2,v_escola2,'16161616-1616-4616-8616-161616161616','17171717-1717-4717-8717-171717171717');
  INSERT INTO public.financeiro_tabelas(id,escola_id,ano_letivo,curso_id,classe_id,valor_mensalidade,dia_vencimento)
  VALUES ('18181818-1818-4818-8818-181818181818',v_escola1,y,'16161616-1616-4616-8616-161616161616','17171717-1717-4717-8717-171717171717',10000,10);
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo,status,percentagem_desconto)
  VALUES
    (v_mat1,v_escola1,v_aluno1,v_turma1,y,'ativa',0),
    (v_mat2,v_escola2,v_aluno2,v_turma2,y,'ativa',0),
    (v_mat3,v_escola1,v_aluno3,v_turma1,y,'ativa',25);
  INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,status)
  SELECT v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
         extract(month from d)::int,extract(year from d)::int,d+9,
         10000,10000,10000,'pendente'
    FROM unnest(array[dp,d0,d1]) d;
  INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,
      valor_pago_total,status)
  VALUES (v_parcial,v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
          extract(month from d2)::int,extract(year from d2)::int,d2+9,
          10000,10000,10000,4000,'pago_parcial');
  INSERT INTO public.pagamentos(escola_id,aluno_id,mensalidade_id,valor_pago,status)
  VALUES(v_escola1,v_aluno1,v_parcial,4000,'settled');
  INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,
      valor_pago_total,status,status_fiscal)
  VALUES(v_fiscal,v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
         extract(month from d3)::int,extract(year from d3)::int,d3+9,
         10000,10000,10000,3500,'pago_parcial','ok');
  INSERT INTO public.pagamentos(escola_id,aluno_id,mensalidade_id,valor_pago,status,
      fiscal_documento_id,status_fiscal)
  VALUES(v_escola1,v_aluno1,v_fiscal,3500,'settled',
        '19191919-1919-4919-8919-191919191919','ok');
  -- Inconsistência pré-existente: não tomar 5.000 Kz de saldo como liquidados
  -- quando os pagamentos efetivamente registados somam só 2.500 Kz.
  INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,
      valor_pago_total,status)
  SELECT v_inconsistente,v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
         extract(month from d)::int,extract(year from d)::int,d+9,
         10000,10000,10000,5000,'pago_parcial'
  FROM (SELECT (d3+interval '2 months')::date AS d) q;
  INSERT INTO public.pagamentos(escola_id,aluno_id,mensalidade_id,valor_pago,status)
  VALUES(v_escola1,v_aluno1,v_inconsistente,2500,'settled');
  INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,status)
  VALUES (v_escola2,v_aluno2,v_mat2,v_turma2,y::text,
          extract(month from d0)::int,extract(year from d0)::int,d0+9,
          10000,10000,10000,'pendente');

  PERFORM set_config('request.jwt.claim.sub',v_denied::text,false);
  BEGIN
    PERFORM public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,true,'Bolsa de teste',d0);
    RAISE EXCEPTION 'FAIL: usuário não autorizado conseguiu atribuir bolsa';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_actor1::text,false);
  BEGIN
    PERFORM public.klasse_definir_bolsa_integral(
      v_escola2,v_aluno2,v_mat2,true,'Bolsa externa',d0);
    RAISE EXCEPTION 'FAIL: titular da escola 1 conseguiu alterar escola 2';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,true,'Retroativo proibido',dp);
    RAISE EXCEPTION 'FAIL: vigência retroativa passou na validação';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  v_result := public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,true,'Bolsa de teste',d0);
  IF v_result->>'ok' <> 'true' OR v_result->>'vigencia_inicio' <> d0::text THEN
    RAISE EXCEPTION 'FAIL: RPC não confirmou a vigência: %',v_result;
  END IF;

  -- Competência anterior permanece cobrada, mês atual e próximo são isentos.
  SELECT count(*) INTO v_count FROM public.mensalidades
    WHERE matricula_id=v_mat1 AND data_vencimento < d0
      AND status='pendente' AND valor=10000;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: bolsa retroagiu para o mês anterior'; END IF;
  SELECT count(*) INTO v_count FROM public.mensalidades
    WHERE matricula_id=v_mat1 AND date_trunc('month',data_vencimento)::date IN (d0,d1)
      AND status='isento' AND valor=0 AND bolsa_isencao_integral;
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: isenção não aplicada à vigência atual e futura (%).',v_count; END IF;

  SELECT valor_pago_total INTO v_val FROM public.mensalidades WHERE id=v_parcial;
  IF v_val<>4000 OR NOT EXISTS(
    SELECT 1 FROM public.mensalidades WHERE id=v_parcial AND status='pago'
      AND valor=4000 AND valor_previsto=4000 AND desconto_aplicado=6000
      AND bolsa_isencao_integral
  ) THEN RAISE EXCEPTION 'FAIL: saldo parcial não foi corretamente perdoado'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pagamentos WHERE mensalidade_id=v_parcial
                AND valor_pago=4000 AND status='settled') THEN
    RAISE EXCEPTION 'FAIL: pagamento parcial foi modificado';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.fixture_ledger
    WHERE mensalidade_id=v_parcial AND tipo='credito' AND delta=6000) THEN
    RAISE EXCEPTION 'FAIL: abatimento não gerou crédito na ledger';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE id=v_fiscal AND status='pago_parcial' AND valor=10000 AND valor_pago_total=3500)
    OR v_result->>'pendentes_revisao_fiscal' <> '1' THEN
    RAISE EXCEPTION 'FAIL: título fiscalizado foi alterado ou não foi sinalizado';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE id=v_inconsistente AND status='pago_parcial' AND valor_pago_total=5000
      AND valor=10000)
    OR v_result->>'pendentes_revisao_pagamento' <> '1' THEN
    RAISE EXCEPTION 'FAIL: parcial inconsistente foi liquidado indevidamente';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE escola_id=v_escola2 AND status='pendente' AND valor=10000) THEN
    RAISE EXCEPTION 'FAIL: bolsa alterou escola alheia';
  END IF;

  -- Gerador em lote: recupera mês ANTERIOR à vigência, não cobra o posterior.
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo,status,
    bolsa_integral,bolsa_integral_inicio)
  VALUES(v_mat4,v_escola1,v_aluno4,v_turma1,y,'ativa',true,d0);
  v_extra := public.gerar_mensalidades_lote(v_escola1,y,extract(month from dp)::int,10,v_turma1);
  IF v_extra->>'ok'<>'true' OR NOT EXISTS(
      SELECT 1 FROM public.mensalidades WHERE matricula_id=v_mat4
        AND date_trunc('month',data_vencimento)::date=dp AND status='pendente' AND valor=10000
    ) THEN
    RAISE EXCEPTION 'FAIL: gerador não conservou as competências pré-bolsa: %',v_extra;
  END IF;
  v_extra := public.gerar_mensalidades_lote(v_escola1,y,extract(month from d1)::int,10,v_turma1);
  IF v_extra->>'ok'<>'true' OR EXISTS(
      SELECT 1 FROM public.mensalidades WHERE matricula_id=v_mat4
        AND date_trunc('month',data_vencimento)::date=d1
    ) THEN
    RAISE EXCEPTION 'FAIL: gerador cobrou mês com bolsa ativa: %',v_extra;
  END IF;

  -- Defesa no BD: nenhuma nova propina para matrícula bolseira.
  INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,status)
  SELECT v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
         extract(month from d)::int,extract(year from d)::int,d+9,
         10000,10000,10000,'pendente'
    FROM (SELECT (d3+interval '1 month')::date AS d) q;
  SELECT count(*) INTO v_count FROM public.mensalidades
    WHERE matricula_id=v_mat1 AND
      date_trunc('month',data_vencimento)::date=(d3+interval '1 month')::date;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: rota direta contornou o SSOT da bolsa'; END IF;

  v_result := public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,false,NULL,d1);
  IF v_result->>'reabertas' <> '1' THEN
    RAISE EXCEPTION 'FAIL: retirada não reabriu apenas futura propina: %',v_result;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE matricula_id=v_mat1 AND date_trunc('month',data_vencimento)::date=d0
      AND status='isento' AND valor=0) THEN
    RAISE EXCEPTION 'FAIL: retirada recobrou mês já isento';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE matricula_id=v_mat1 AND date_trunc('month',data_vencimento)::date=d1
      AND status='pendente' AND valor=10000 AND NOT bolsa_isencao_integral) THEN
    RAISE EXCEPTION 'FAIL: retirada não regenerou cobrança do próximo mês';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mensalidades
    WHERE id=v_parcial AND status='pago' AND valor_pago_total=4000) THEN
    RAISE EXCEPTION 'FAIL: retirada reverteu parcial quitada';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs
      WHERE action='BOLSA_INTEGRAL_ATUALIZADA' AND escola_id=v_escola1) <> 2 THEN
    RAISE EXCEPTION 'FAIL: faltam eventos auditados de ativação/retirada';
  END IF;

  -- Caso real: a escola esqueceu a bolsa na matrícula e já gerou as primeiras
  -- mensalidades. Uma decisão retroativa com justificativa deve perdoar apenas
  -- as parcelas anteriores não pagas, preservando qualquer pagamento parcial.
  INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
      mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,
      valor_pago_total,status)
  SELECT v_antiga_parcial,v_escola1,v_aluno1,v_mat1,v_turma1,y::text,
         extract(month from d)::int,extract(year from d)::int,d+9,
         10000,10000,10000,3000,'pago_parcial'
    FROM (SELECT (dp - interval '1 month')::date AS d) q;
  INSERT INTO public.pagamentos(escola_id,aluno_id,mensalidade_id,valor_pago,status)
  VALUES(v_escola1,v_aluno1,v_antiga_parcial,3000,'settled');

  BEGIN
    PERFORM public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,true,'Bolsa aprovada',dp,true,NULL);
    RAISE EXCEPTION 'FAIL: isenção retroativa sem justificativa foi aceite';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.klasse_definir_bolsa_integral(
      v_escola1,v_aluno1,v_mat1,true,'Bolsa aprovada',dp,false,'A escola omitiu a bolsa');
    RAISE EXCEPTION 'FAIL: isenção retroativa sem autorização explícita foi aceite';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  v_result := public.klasse_definir_bolsa_integral(
    v_escola1,v_aluno1,v_mat1,true,'Bolsa aprovada',(dp-interval '1 month')::date,
    true,'Bolsa aprovada no ato da matrícula, mas não registada.');
  IF v_result->>'regularizacao_retroativa' <> 'true'
     OR NOT EXISTS(SELECT 1 FROM public.mensalidades
       WHERE matricula_id=v_mat1
         AND date_trunc('month',data_vencimento)::date=dp
         AND status='isento' AND valor=0 AND bolsa_isencao_integral)
     OR NOT EXISTS(SELECT 1 FROM public.mensalidades
       WHERE id=v_antiga_parcial AND status='pago_parcial'
         AND valor_pago_total=3000 AND valor=10000)
     OR NOT EXISTS(SELECT 1 FROM public.pagamentos
       WHERE mensalidade_id=v_antiga_parcial AND status='settled' AND valor_pago=3000)
  THEN RAISE EXCEPTION 'FAIL: regularização de mensalidades antigas indevida: %',v_result;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_logs
    WHERE action='BOLSA_INTEGRAL_ATUALIZADA' AND escola_id=v_escola1
      AND details->>'regularizacao_retroativa'='true'
      AND char_length(details->>'justificativa_retroativa')>=10
  ) THEN
    RAISE EXCEPTION 'FAIL: regularização retroativa sem auditoria de motivo';
  END IF;

  -- Candidatura ainda grava bolsa legada como desconto 100%.
  -- O trigger deve normalizar para SSOT e a retirada deve funcionar também.
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo,status,
    percentagem_desconto,motivo_desconto)
  VALUES(v_mat5,v_escola1,v_aluno5,v_turma1,y,'ativa',100,'Bolsa aprovada na candidatura');
  IF NOT EXISTS(SELECT 1 FROM public.matriculas
    WHERE id=v_mat5 AND bolsa_integral AND bolsa_integral_inicio IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: desconto legado de candidatura não foi normalizado em bolsa SSOT';
  END IF;
  INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
    mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,status)
  VALUES(v_escola1,v_aluno5,v_mat5,v_turma1,y::text,
    extract(month from d0)::int,extract(year from d0)::int,d0+9,
    10000,10000,10000,'pendente');
  IF EXISTS (SELECT 1 FROM public.mensalidades WHERE matricula_id=v_mat5) THEN
    RAISE EXCEPTION 'FAIL: candidatura criou cobrança apesar da bolsa';
  END IF;
  PERFORM public.klasse_definir_bolsa_integral(v_escola1,v_aluno5,v_mat5,false,NULL,d1);
  IF NOT EXISTS(SELECT 1 FROM public.matriculas WHERE id=v_mat5
        AND NOT bolsa_integral AND percentagem_desconto=0 AND motivo_desconto IS NULL) THEN
    RAISE EXCEPTION 'FAIL: retirada da bolsa originada na candidatura não persistiu';
  END IF;
  v_extra:=public.gerar_mensalidades_lote(v_escola1,y,extract(month from d1)::int,10,v_turma1);
  IF v_extra->>'ok'<>'true' OR NOT EXISTS(SELECT 1 FROM public.mensalidades
      WHERE matricula_id=v_mat5 AND date_trunc('month',data_vencimento)::date=d1
      AND status='pendente' AND valor=10000) THEN
    RAISE EXCEPTION 'FAIL: propinas não regressaram após retirada da bolsa de candidatura: %',v_extra;
  END IF;

  -- Renovação: uma nova matrícula nunca herda a bolsa do ano precedente.
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo,status)
  VALUES('20202020-2020-4020-8020-202020202020',v_escola1,v_aluno1,v_turma1,y+1,'ativa');
  IF NOT EXISTS (SELECT 1 FROM public.matriculas
    WHERE aluno_id=v_aluno1 AND escola_id=v_escola1 AND ano_letivo=y+1
      AND NOT bolsa_integral AND percentagem_desconto=0) THEN
    RAISE EXCEPTION 'FAIL: a bolsa foi herdada na renovação';
  END IF;

  -- A geração por lote deve respeitar o desconto parcial de 25%.
  v_result := public.gerar_mensalidades_lote(v_escola1,y,
               extract(month from d0)::int,10,v_turma1);
  IF v_result->>'ok' <> 'true' THEN
    RAISE EXCEPTION 'FAIL: RPC de geração: %', v_result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mensalidades
    WHERE matricula_id=v_mat3 AND valor=7500 AND valor_original=10000
      AND desconto_aplicado=2500 AND status='pendente') THEN
    RAISE EXCEPTION 'FAIL: geração por lote ignorou o desconto parcial de 25%%';
  END IF;

  -- Admissão: atribuição integral no rascunho deve chegar à matrícula
  -- antes da geração do carnet anual, sem segunda chamada à API.
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo,status)
    VALUES(v_mat6,v_escola1,v_aluno6,v_turma1,y,'ativa');
  INSERT INTO public.candidaturas(id,escola_id,aluno_id,ano_letivo,status,matricula_id,
                                  percentagem_desconto,motivo_desconto)
    VALUES(v_cand6,v_escola1,v_aluno6,y,'aprovada',null,100,'Bolsa integral');
  PERFORM set_config('request.jwt.claim.sub',v_denied::text,false);
  BEGIN
    UPDATE public.candidaturas SET status='matriculado',matricula_id=v_mat6 WHERE id=v_cand6;
    RAISE EXCEPTION 'FAIL: admissão autorizou bolsa sem papel válido';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_actor1::text,false);
  UPDATE public.candidaturas SET status='matriculado',matricula_id=v_mat6 WHERE id=v_cand6;
  IF NOT EXISTS (
    SELECT 1 FROM public.matriculas
    WHERE id=v_mat6 AND bolsa_integral AND percentagem_desconto=100
      AND bolsa_integral_inicio=date_trunc('month',(dp - interval '1 month')::date)::date
  ) THEN
    RAISE EXCEPTION 'FAIL: bolsa da candidatura não sincronizou com a matrícula';
  END IF;
  INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
        mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,status)
    VALUES(v_escola1,v_aluno6,v_mat6,v_turma1,y::text,
      extract(month from d0)::int,extract(year from d0)::int,d0+9,10000,10000,10000,'pendente');
  IF EXISTS (SELECT 1 FROM public.mensalidades WHERE matricula_id=v_mat6) THEN
    RAISE EXCEPTION 'FAIL: a candidatura com bolsa gerou mensalidade pendente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE escola_id=v_escola1 AND entity_id=v_mat6::text
      AND action='BOLSA_INTEGRAL_NA_MATRICULA'
  ) THEN RAISE EXCEPTION 'FAIL: falta auditoria da bolsa registada na admissão'; END IF;

  RAISE NOTICE 'OK PG17: permissão/tenant, vigência, pré-bolsa, parciais, ledger, fiscal, bloqueio direto, retirada, renovação e desconto 25%%';
END;
$$;
