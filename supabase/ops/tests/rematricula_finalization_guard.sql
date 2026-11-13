-- Synthetic PostgreSQL integration test. All IDs and money are fictitious.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.safe_auth_uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text);
CREATE FUNCTION public.user_has_role_in_school(p_escola_id uuid,p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.escola_users e
 WHERE e.escola_id=p_escola_id AND e.user_id=auth.uid() AND e.papel=ANY(p_roles))
$$;
CREATE FUNCTION public.canonicalize_matricula_status_text(text) RETURNS text LANGUAGE sql
IMMUTABLE AS $$ SELECT lower($1) $$;
CREATE FUNCTION public.resolve_raa_progression_for_matricula(uuid,uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT '{"decision":"transitou","destino":"proxima_etapa"}'::jsonb $$;
CREATE TABLE public.classes(id uuid PRIMARY KEY,numero integer,nome text);
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano integer,ativo boolean);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,session_id uuid,ano_letivo integer,
  classe_id uuid,curso_id uuid,nivel_ensino text,capacidade_maxima integer,status_fecho text);
CREATE TABLE public.matriculas(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,turma_id uuid,
  session_id uuid,ano_letivo integer,status text,ativo boolean,numero_matricula text,
  origem_transicao_matricula_id uuid,data_inicio_financeiro date,data_matricula date,
  created_at timestamptz DEFAULT now(),updated_at timestamptz,motivo_fecho text,data_fecho timestamptz);
CREATE FUNCTION public.confirmar_matricula_core(p_aluno_id uuid,p_ano integer,p_turma_id uuid,p_matricula_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 UPDATE public.matriculas SET numero_matricula='999001' WHERE id=p_matricula_id;
 RETURN 999001;
END $$;
CREATE FUNCTION public.finalizar_origem_academica(uuid,uuid,text,text,text,text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE TABLE public.rematricula_janelas(escola_id uuid,ano_letivo integer,ativa boolean,
  data_inicio timestamptz,data_fim timestamptz);
CREATE TABLE public.audit_logs(escola_id uuid,actor_id uuid,action text,entity text,
  entity_id text,portal text,details jsonb);
CREATE TABLE public.servicos_escola(id uuid PRIMARY KEY,escola_id uuid,codigo text,
  valor_base numeric,ativo boolean);
CREATE TABLE public.servico_pedidos(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,
  matricula_id uuid,servico_escola_id uuid,servico_codigo text,status text,
  valor_cobrado numeric,contexto jsonb);
CREATE TABLE public.financeiro_tabelas(id uuid PRIMARY KEY,escola_id uuid,ano_letivo integer,
  curso_id uuid,classe_id uuid,valor_confirmacao numeric,
  updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE public.pagamentos(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,
  status text,settled_at timestamptz,settled_by uuid,valor_pago numeric,
  mensalidade_id uuid,meta jsonb);
CREATE TABLE public.documentos_emitidos(id uuid PRIMARY KEY,escola_id uuid,
  aluno_id uuid,tipo text,mensalidade_id uuid,revoked_at timestamptz,dados_snapshot jsonb);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
GRANT INSERT,UPDATE,SELECT ON public.pagamentos,public.documentos_emitidos TO authenticated;

-- Compile the latest complete writer as well as the payment-evidence gate.
\ir ../../migrations/20271112100000_rematricula_finalization_payment_guard.sql

INSERT INTO public.escola_users VALUES
('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','secretaria');
INSERT INTO public.anos_letivos VALUES
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',2026,true);
INSERT INTO public.classes VALUES
('50000000-0000-4000-8000-000000000001',3,'3ª'),
('50000000-0000-4000-8000-000000000002',4,'4ª');
INSERT INTO public.turmas VALUES
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',NULL,2025,
 '50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','primario',50,'aberto'),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',2026,
 '50000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','primario',50,'aberto');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,origem_transicao_matricula_id) VALUES
('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',
 NULL,2025,'concluido',false,NULL),
('80000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002',
 '40000000-0000-4000-8000-000000000001',2026,'pendente',false,
 '80000000-0000-4000-8000-000000000001');
INSERT INTO public.servicos_escola VALUES
('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','SERV_REMATRICULA',2000,true);
INSERT INTO public.financeiro_tabelas(id,escola_id,ano_letivo,curso_id,classe_id,valor_confirmacao) VALUES
('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',2026,
 '70000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000002',2000);
INSERT INTO public.servico_pedidos VALUES
('c0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','SERV_REMATRICULA','pending_payment',2000,
 jsonb_build_object('origem_matricula_id','80000000-0000-4000-8000-000000000001',
 'ano_letivo_id','40000000-0000-4000-8000-000000000001',
 'destino_turma_id','60000000-0000-4000-8000-000000000002',
 'matricula_destino_preparada_id','80000000-0000-4000-8000-000000000002')),
('c0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',
 '90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','SERV_REMATRICULA','pending_payment',2000,'{}'::jsonb),
('c0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000009','80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','SERV_REMATRICULA','pending_payment',2000,'{}'::jsonb),
('c0000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','CERTIFICADO','pending_payment',2000,'{}'::jsonb),
('c0000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','SERV_REMATRICULA','pending_payment',2000,
 '{"origem_matricula_id":"80000000-0000-4000-8000-000000000001",
 "ano_letivo_id":"40000000-0000-4000-8000-000000000001",
 "destino_turma_id":"60000000-0000-4000-8000-000000000099"}'::jsonb);

CREATE FUNCTION public.expect_financial_rejection(p_order uuid,p_code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.finalizar_rematricula_balcao(
     '10000000-0000-4000-8000-000000000001',
     '90000000-0000-4000-8000-000000000001',
     '80000000-0000-4000-8000-000000000001',
     '40000000-0000-4000-8000-000000000001',
     '60000000-0000-4000-8000-000000000002',
     p_order
    );
    RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>p_code THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;

-- Even authorized staff cannot finalize an arbitrary/other-school/order-type request.
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000002','REMATRICULA_ORDER_INVALID');
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000003','REMATRICULA_ORDER_INVALID');
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000004','REMATRICULA_ORDER_INVALID');
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000005','REMATRICULA_ORDER_SCOPE_MISMATCH');
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000001','REMATRICULA_PAYMENT_NOT_SETTLED');

-- No direct financial proof forgery via PostgREST.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.pagamentos VALUES
      ('d0000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000001','settled',now(),
      '30000000-0000-4000-8000-000000000001',2000,NULL,
      '{"pedido_id":"c0000000-0000-4000-8000-000000000001"}'::jsonb);
    RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECT_SETTLEMENT_FORBIDDEN' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.documentos_emitidos VALUES
      ('e0000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000001','recibo',NULL,NULL,
      '{"pagamento_id":"d0000000-0000-4000-8000-000000000099"}'::jsonb);
    RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECT_RECEIPT_MUTATION_FORBIDDEN' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Finance writes through privileged ledger/RPC actors in fixture.
INSERT INTO public.pagamentos VALUES
 ('d0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001','settled',now(),
  '30000000-0000-4000-8000-000000000001',1500,NULL,
  '{"pedido_id":"c0000000-0000-4000-8000-000000000001"}'::jsonb);
SET ROLE authenticated;
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000001','REMATRICULA_PAYMENT_NOT_SETTLED');
RESET ROLE;
INSERT INTO public.pagamentos VALUES
 ('d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001','settled',now(),
  '30000000-0000-4000-8000-000000000001',500,NULL,
  '{"pedido_id":"c0000000-0000-4000-8000-000000000001"}'::jsonb);
SET ROLE authenticated;
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000001','REMATRICULA_SERVICE_RECEIPT_REQUIRED');
RESET ROLE;
-- Even a document tagged "recibo" is not evidence if it is a monthly receipt.
INSERT INTO public.documentos_emitidos VALUES
 ('e0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','recibo',
 'f0000000-0000-4000-8000-000000000001',NULL,
 '{"pagamento_id":"d0000000-0000-4000-8000-000000000002"}'::jsonb);
SET ROLE authenticated;
SELECT public.expect_financial_rejection('c0000000-0000-4000-8000-000000000001','REMATRICULA_SERVICE_RECEIPT_REQUIRED');
RESET ROLE;
INSERT INTO public.documentos_emitidos VALUES
 ('e0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','recibo',NULL,NULL,
 '{"pagamento_id":"d0000000-0000-4000-8000-000000000002"}'::jsonb);

-- Fiscal metadata may change without changing immutable settlement evidence.
ALTER TABLE public.pagamentos ADD COLUMN status_fiscal text;
SET ROLE authenticated;
UPDATE public.pagamentos SET status_fiscal='ok'
 WHERE id='d0000000-0000-4000-8000-000000000002';
DO $ BEGIN
  BEGIN
    UPDATE public.pagamentos SET meta='{"pedido_id":"c0000000-0000-4000-8000-000000000009"}'::jsonb
     WHERE id='d0000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECT_SETTLEMENT_FORBIDDEN' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.documentos_emitidos SET dados_snapshot='{}'::jsonb
      WHERE id='e0000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECT_RECEIPT_MUTATION_FORBIDDEN' THEN RAISE; END IF;
  END;
END $;
RESET ROLE;
DO $ BEGIN
 ASSERT (SELECT status_fiscal='ok' AND status='settled'
         FROM public.pagamentos WHERE id='d0000000-0000-4000-8000-000000000002');
END $;

SET ROLE authenticated;
DO $ DECLARE r jsonb; BEGIN
 r := public.finalizar_rematricula_balcao(
 '10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',
 '80000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001');
 ASSERT r->>'ok'='true';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM public.matriculas WHERE id='80000000-0000-4000-8000-000000000002' AND ativo AND status='ativo');
 ASSERT (SELECT status='granted' AND matricula_id='80000000-0000-4000-8000-000000000002'
         FROM public.servico_pedidos WHERE id='c0000000-0000-4000-8000-000000000001');
 ASSERT (SELECT count(*)=2 FROM public.matriculas WHERE aluno_id='90000000-0000-4000-8000-000000000001');
END $$;

-- A zero-cost confirmation needs an explicit class fee waiver.
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo) VALUES
('80000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',NULL,2025,'concluido',false),
('80000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',
 '40000000-0000-4000-8000-000000000001',2026,'pendente',false);
INSERT INTO public.servico_pedidos VALUES
('c0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000001','SERV_REMATRICULA','granted',0,
 '{"origem_matricula_id":"80000000-0000-4000-8000-000000000003",
 "ano_letivo_id":"40000000-0000-4000-8000-000000000001",
 "destino_turma_id":"60000000-0000-4000-8000-000000000002"}'::jsonb);
-- Test the helper's exact school/student/year context without creating any charge.
CREATE FUNCTION public.expect_zero_rejected() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
 PERFORM public._assert_rematricula_payment_proof(
 '10000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002',
 '80000000-0000-4000-8000-000000000003',
 '40000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000006',2026,
 '80000000-0000-4000-8000-000000000004');
 RAISE EXCEPTION 'EXPECTED_DENIAL_MISSING';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM<>'REMATRICULA_ORDER_AMOUNT_INVALID' THEN RAISE; END IF;
 END;
END $$;
SELECT public.expect_zero_rejected();
UPDATE public.financeiro_tabelas SET valor_confirmacao=0
WHERE id='b0000000-0000-4000-8000-000000000001';
-- Executes the helper as owner via SECURITY DEFINER writer.
SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r := public.finalizar_rematricula_balcao(
 '10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002',
 '80000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000006');
 ASSERT r->>'ok'='true';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT status='ativo' AND ativo=true
         FROM public.matriculas WHERE id='80000000-0000-4000-8000-000000000004');
END $$;
SELECT 'REMATRICULA_FINALIZATION_GUARD_PASS' AS result;
