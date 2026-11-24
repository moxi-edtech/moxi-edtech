-- Testes reais de PostgreSQL 17 sobre o fixture isolado de bolsa integral.
\set ON_ERROR_STOP on
CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL,
 mensalidade_id uuid REFERENCES public.mensalidades(id)
);
DO $$
DECLARE
 s uuid := gen_random_uuid(); outro uuid := gen_random_uuid();
 aluno uuid := gen_random_uuid(); m uuid := gen_random_uuid(); t uuid := gen_random_uuid();
 ator uuid := gen_random_uuid(); nao_autorizado uuid := gen_random_uuid();
 aluno2 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid();
 mp uuid := gen_random_uuid(); mf uuid := gen_random_uuid(); atual uuid := gen_random_uuid();
 d0 date := date_trunc('month',timezone('Africa/Luanda',now()))::date;
 d1 date := (d0 + interval '1 month')::date;
 d2 date := (d0 + interval '2 months')::date;
 d3 date := (d0 + interval '3 months')::date;
 dp date := (d0 - interval '1 month')::date;
 y int := extract(year from dp)::int;
 r jsonb;
BEGIN
 INSERT INTO public.escola_users VALUES(s,ator,'admin_financeiro');
 INSERT INTO public.anos_letivos(id,escola_id,ano,data_inicio,data_fim) VALUES
   (gen_random_uuid(),s,y,dp,(d3+interval '3 months')::date),
   (gen_random_uuid(),outro,y,dp,(d3+interval '3 months')::date);
 INSERT INTO public.turmas(id,escola_id) VALUES(t,s),(t2,outro);
 INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,ano_letivo)
 VALUES(m,s,aluno,t,y),(m2,outro,aluno2,t2,y);
 INSERT INTO public.financeiro_tabelas(id,escola_id,ano_letivo,valor_mensalidade,dia_vencimento)
 VALUES(gen_random_uuid(),s,y,10000,10);
 INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
   mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original,valor_pago_total,status)
 VALUES
   (atual,s,aluno,m,t,y::text,extract(month from d0),extract(year from d0),d0+9,10000,10000,10000,0,'pendente'),
   (mp,s,aluno,m,t,y::text,extract(month from d1),extract(year from d1),d1+9,10000,10000,10000,1000,'pago_parcial'),
   (mf,s,aluno,m,t,y::text,extract(month from d2),extract(year from d2),d2+9,10000,10000,10000,0,'pendente');
 INSERT INTO public.pagamentos(escola_id,aluno_id,mensalidade_id,valor_pago) VALUES(s,aluno,mp,1000);
 INSERT INTO public.documentos_emitidos(escola_id,mensalidade_id) VALUES(s,mf);
 PERFORM set_config('request.jwt.claim.sub',nao_autorizado::text,false);
 BEGIN
  PERFORM public.klasse_definir_bolsa_parcial(s,aluno,m,50,NULL,d0);
  RAISE EXCEPTION 'FAIL: utilizador sem autorização';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',ator::text,false);
 BEGIN
  PERFORM public.klasse_definir_bolsa_parcial(outro,aluno2,m2,50,NULL,d0);
  RAISE EXCEPTION 'FAIL: acesso a outra escola';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.klasse_definir_bolsa_parcial(s,aluno,m,100,NULL,d0);
  RAISE EXCEPTION 'FAIL: 100%% deve usar RPC integral';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM public.klasse_definir_bolsa_parcial(s,aluno,m,50,NULL,dp);
  RAISE EXCEPTION 'FAIL: retroatividade sem justificação';
 EXCEPTION WHEN check_violation THEN NULL; END;
 r := public.klasse_definir_bolsa_parcial(s,aluno,m,50,'Bolsa parcial',d0);
 IF r->>'alteradas' IS DISTINCT FROM '1' OR r->>'pendentes_revisao_pagamento' IS DISTINCT FROM '2'
 OR NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE id=atual AND valor=5000 AND valor_previsto=5000 AND desconto_aplicado=5000)
 OR NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE id=mp AND valor=10000 AND valor_pago_total=1000)
 OR NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE id=mf AND valor=10000)
 OR NOT EXISTS(SELECT 1 FROM public.fixture_ledger WHERE mensalidade_id=atual AND tipo='credito' AND delta=5000)
 THEN RAISE EXCEPTION 'FAIL: atribuição e preservação financeira: %',r; END IF;
 BEGIN
  PERFORM public.klasse_definir_bolsa_integral(s,aluno,m,true,'Bolsa integral',d0);
  RAISE EXCEPTION 'FAIL: sobreposição integral/parcial';
 EXCEPTION WHEN check_violation THEN NULL; END;
 -- Geração por rota RPC e inserção direta convergem no mesmo trigger.
 r := public.gerar_mensalidades_lote(s,y,extract(month from d3)::int,10,t);
 IF r->>'ok' IS DISTINCT FROM 'true' OR NOT EXISTS(
  SELECT 1 FROM public.mensalidades WHERE matricula_id=m AND date_trunc('month',data_vencimento)::date=d3 AND valor=5000
 ) THEN RAISE EXCEPTION 'FAIL: geração em lote com bolsa: %',r; END IF;
 r := public.klasse_definir_bolsa_parcial(s,aluno,m,25,'Alteração',d1);
 IF NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE id=atual AND valor=5000)
 OR NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE matricula_id=m AND date_trunc('month',data_vencimento)::date=d3 AND valor=7500)
 THEN RAISE EXCEPTION 'FAIL: alteração de vigência: %',r; END IF;
 r := public.klasse_definir_bolsa_parcial(s,aluno,m,0,NULL,d3);
 IF NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE id=atual AND valor=5000)
 OR NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE matricula_id=m AND date_trunc('month',data_vencimento)::date=d3 AND valor=10000)
 OR NOT EXISTS(SELECT 1 FROM public.matriculas WHERE id=m AND bolsa_parcial_percentagem=0
   AND public.klasse_percentagem_bolsa_parcial(bolsa_parcial_periodos,d0)=50
   AND public.klasse_percentagem_bolsa_parcial(bolsa_parcial_periodos,d1)=25
   AND public.klasse_percentagem_bolsa_parcial(bolsa_parcial_periodos,d3)=0)
 THEN RAISE EXCEPTION 'FAIL: retirada e histórico: %',r; END IF;
 -- Competência anterior à bolsa nunca recebe o desconto.
 INSERT INTO public.mensalidades(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,
    mes_referencia,ano_referencia,data_vencimento,valor,valor_previsto,valor_original)
 VALUES(s,aluno,m,t,y::text,extract(month from dp),extract(year from dp),dp+9,10000,10000,10000);
 IF NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE matricula_id=m AND data_vencimento=dp+9 AND valor=10000)
 THEN RAISE EXCEPTION 'FAIL: competência anterior afetada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE escola_id=s AND entity_id=m::text AND action='BOLSA_PARCIAL_ATUALIZADA' AND details->>'percentagem'='50')
 THEN RAISE EXCEPTION 'FAIL: falta auditoria'; END IF;
 RAISE NOTICE 'OK: atribuição, alteração, retirada, vigência, pagamentos, fiscal, ledger e isolamento';
END $$;

-- A Data API não pode escrever o SSOT diretamente, ainda que a tabela
-- permita outros updates de matrícula. O teste simula o role autenticado.
GRANT SELECT,UPDATE ON public.matriculas TO authenticated;
SET ROLE authenticated;
DO $$
BEGIN
 BEGIN
  UPDATE public.matriculas SET bolsa_parcial_percentagem=10,
    bolsa_parcial_periodos='[{"inicio":"2026-01-01","percentagem":10}]'::jsonb
   WHERE id=(SELECT id FROM public.matriculas WHERE NOT bolsa_integral AND coalesce(percentagem_desconto,0)=0 LIMIT 1);
  RAISE EXCEPTION 'FAIL: escrita direta de bolsa';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
