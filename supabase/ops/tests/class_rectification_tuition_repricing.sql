-- Disposable PostgreSQL regression for class correction + monthly fee reconciliation.
-- Runs only in CI, never in a connected school database.
\set ON_ERROR_STOP on
BEGIN;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('klasse.fixture_actor',true),'')::uuid $$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('klasse.fixture_school',true),'')::uuid $$;
CREATE FUNCTION public.user_has_role_in_school(uuid,text[]) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT $1 = public.current_tenant_escola_id()
          AND current_setting('klasse.fixture_allowed',true) = 'on' $$;
CREATE FUNCTION public.canonicalize_matricula_status_text(text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower($1) $$;
CREATE FUNCTION public.turma_transfer_academic_evidence_v1(uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT '{"has_evidence":false}'::jsonb $$;

CREATE TABLE public.turmas(
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, nome text,
 classe_id uuid, curso_id uuid, ano_letivo int, session_id uuid,
 ano_letivo_id uuid, status_validacao text, capacidade_maxima int);
CREATE TABLE public.matriculas(
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
 turma_id uuid NOT NULL, session_id uuid NOT NULL, ano_letivo int NOT NULL,
 ativo boolean NOT NULL, status text NOT NULL, data_inicio_financeiro date,
 percentagem_desconto numeric DEFAULT 0, updated_at timestamptz, updated_by uuid);
CREATE TABLE public.anos_letivos(
 id uuid PRIMARY KEY, escola_id uuid, ano int, ativo boolean);
CREATE TABLE public.financeiro_tabelas(
 id uuid PRIMARY KEY, escola_id uuid, ano_letivo int,
 curso_id uuid, classe_id uuid, session_id uuid,
 valor_mensalidade numeric, updated_at timestamptz, created_at timestamptz);
CREATE TABLE public.mensalidades(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid,
 aluno_id uuid, matricula_id uuid, turma_id uuid, ano_letivo text,
 status text, valor numeric, valor_previsto numeric, valor_original numeric,
 valor_pago_total numeric, desconto_aplicado numeric, tabela_id uuid, updated_at timestamptz);
CREATE TABLE public.balcao_pauta_turma_correction_nonce(
 escola_id uuid, matricula_id uuid, actor_id uuid,
 turma_origem_id uuid, turma_destino_id uuid);
CREATE TABLE public.notas(id uuid,matricula_id uuid);
CREATE TABLE public.notas_avaliacoes(id uuid,matricula_id uuid);
CREATE TABLE public.melhoria_nota_pedidos(id uuid,matricula_id uuid);
CREATE TABLE public.pautas_oficiais(id uuid,turma_id uuid);
CREATE TABLE public.pagamentos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),aluno_id uuid,escola_id uuid,
 mensalidade_id uuid, status text, valor_pago numeric);
CREATE TABLE public.financeiro_cobrancas(id uuid,aluno_id uuid,escola_id uuid,mensalidade_id uuid);
CREATE TABLE public.financeiro_contratos(
 id uuid, matricula_id uuid, escola_id uuid, desconto_percentual numeric);
CREATE TABLE public.financeiro_lancamentos(id uuid,matricula_id uuid);
CREATE TABLE public.exame_resultados(id uuid,matricula_id uuid);
CREATE TABLE public.frequencia_status_periodo(id uuid,matricula_id uuid);
CREATE TABLE public.documentos_emitidos(id uuid, escola_id uuid, aluno_id uuid, mensalidade_id uuid);
CREATE TABLE public.pagamento_intents(id uuid, escola_id uuid, aluno_id uuid, meta jsonb);
CREATE TABLE public.audit_logs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 escola_id uuid, actor_id uuid, action text, entity text, entity_id text,
 portal text, details jsonb, before jsonb, after jsonb);
CREATE TABLE public.fixture_ledger(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 mensalidade_id uuid, delta numeric);
CREATE FUNCTION public.fixture_guard_monthly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.turma_id IS DISTINCT FROM
     (SELECT m.turma_id FROM public.matriculas m WHERE m.id=NEW.matricula_id)
 THEN RAISE EXCEPTION 'Monthly class must follow current enrollment'; END IF;
 IF NEW.valor_pago_total IS DISTINCT FROM OLD.valor_pago_total
   OR (OLD.status IN ('pago','cancelado') AND NEW IS DISTINCT FROM OLD)
 THEN RAISE EXCEPTION 'Paid/cancelled monthly cannot be modified'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_monthly_guard BEFORE UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.fixture_guard_monthly();

CREATE FUNCTION public.fixture_ledger_adjustment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.valor IS DISTINCT FROM OLD.valor THEN
   INSERT INTO public.fixture_ledger(mensalidade_id,delta)
   VALUES(NEW.id,NEW.valor-OLD.valor);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER fixture_ledger AFTER UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.fixture_ledger_adjustment();

-- Nonce must surround the enrollment update.
CREATE FUNCTION public.fixture_enrollment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.turma_id IS DISTINCT FROM OLD.turma_id AND NOT EXISTS (
   SELECT 1 FROM public.balcao_pauta_turma_correction_nonce n
   WHERE n.matricula_id=NEW.id AND n.escola_id=NEW.escola_id
     AND n.turma_origem_id=OLD.turma_id AND n.turma_destino_id=NEW.turma_id
 ) THEN RAISE EXCEPTION 'Missing authorized academic correction nonce'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_enrollment_guard BEFORE UPDATE OF turma_id ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.fixture_enrollment_guard();

COMMIT;

\ir ../../migrations/20271116090000_balcao_retificacao_classe_repreco_pendentes.sql

BEGIN;
SELECT set_config('klasse.fixture_actor','22222222-2222-2222-2222-222222222222',true);
SELECT set_config('klasse.fixture_school','11111111-1111-1111-1111-111111111111',true);
SELECT set_config('klasse.fixture_allowed','on',true);

INSERT INTO public.anos_letivos VALUES
 ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111',2026,true);
INSERT INTO public.turmas VALUES
 ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','ESG-8',
  '77777777-7777-7777-7777-777777777777','99999999-9999-9999-9999-999999999999',
  2026,'44444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','ativo',40),
 ('66666666-6666-6666-6666-666666666666','11111111-1111-1111-1111-111111111111','ESG-9',
  '88888888-8888-8888-8888-888888888888','99999999-9999-9999-9999-999999999999',
  2026,'44444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','ativo',40),
 ('ffffffff-ffff-ffff-ffff-ffffffffffff','11111111-1111-1111-1111-111111111111','ESG-10-no-price',
  '12121212-1212-1212-1212-121212121212','99999999-9999-9999-9999-999999999999',
  2026,'44444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','ativo',40);
INSERT INTO public.matriculas
 (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,ativo,status,data_inicio_financeiro)
 VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',
 '33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',
 '44444444-4444-4444-4444-444444444444',2026,true,'ativo','2026-09-01'),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111',
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','55555555-5555-5555-5555-555555555555',
 '44444444-4444-4444-4444-444444444444',2026,true,'ativo','2026-09-01');
INSERT INTO public.financeiro_tabelas
(id,escola_id,ano_letivo,curso_id,classe_id,session_id,valor_mensalidade,updated_at,created_at)
 VALUES
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',2026,
 '99999999-9999-9999-9999-999999999999','77777777-7777-7777-7777-777777777777',
 '44444444-4444-4444-4444-444444444444',4000,now(),now()),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111',2026,
 '99999999-9999-9999-9999-999999999999','88888888-8888-8888-8888-888888888888',
 '44444444-4444-4444-4444-444444444444',5000,now(),now());

INSERT INTO public.mensalidades
(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
SELECT '11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555',
 '2026','pendente',4000,4000,4000,0,0,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
FROM generate_series(1,8);
WITH paid AS (
 INSERT INTO public.mensalidades
(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
SELECT '11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555',
 '2026','pago',4000,4000,4000,4000,0,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
FROM generate_series(1,2) RETURNING id
)
INSERT INTO public.pagamentos(aluno_id,escola_id,mensalidade_id,status,valor_pago)
SELECT '33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',
id,'settled',4000 FROM paid;
INSERT INTO public.mensalidades
(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
VALUES
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555',
 '2026','cancelado',4000,4000,4000,0,0,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555',
 '2026','pendente',3900,3900,4000,0,100,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
WITH reserved AS (
 INSERT INTO public.mensalidades
(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
VALUES
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555',
 '2026','pendente',4000,4000,4000,0,0,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
 RETURNING id
)
INSERT INTO public.pagamento_intents(id,escola_id,aluno_id,meta)
SELECT gen_random_uuid(),'11111111-1111-1111-1111-111111111111',
'33333333-3333-3333-3333-333333333333',jsonb_build_object('mensalidade_id',id)
FROM reserved;
-- Enrollment used to assert that missing target pricing rolls back cleanly.
INSERT INTO public.mensalidades
(escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
VALUES
('11111111-1111-1111-1111-111111111111','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
 'dddddddd-dddd-dddd-dddd-dddddddddddd','55555555-5555-5555-5555-555555555555',
 '2026','pendente',4000,4000,4000,0,0,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');


-- A separate pupil entered in Primary 6 instead of Secondary 7, within 2026.
-- Different courses, same school and academic session; one untouched fee.
INSERT INTO public.turmas
 (id,escola_id,nome,classe_id,curso_id,ano_letivo,session_id,ano_letivo_id,status_validacao,capacidade_maxima)
VALUES
 ('16161616-1616-4161-8161-161616161616','11111111-1111-1111-1111-111111111111','EP-6ª Classe-M-A',
  '18181818-1818-4181-8181-181818181818','20202020-2020-4202-8202-202020202020',2026,
  '44444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','ativo',40),
 ('17171717-1717-4171-8171-171717171717','11111111-1111-1111-1111-111111111111','ESG-7ª Classe-T-A',
  '19191919-1919-4191-8191-191919191919','21212121-2121-4212-8212-212121212121',2026,
  '44444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','ativo',40);
INSERT INTO public.matriculas
 (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,ativo,status,data_inicio_financeiro)
VALUES
 ('14141414-1414-4141-8414-141414141414','11111111-1111-1111-1111-111111111111',
  '25252525-2525-4252-8252-252525252525','16161616-1616-4161-8161-161616161616',
  '44444444-4444-4444-4444-444444444444',2026,true,'ativo','2026-09-01');
INSERT INTO public.financeiro_tabelas
 (id,escola_id,ano_letivo,curso_id,classe_id,session_id,valor_mensalidade,updated_at,created_at)
VALUES
 ('23232323-2323-4232-8232-232323232323','11111111-1111-1111-1111-111111111111',2026,
  '20202020-2020-4202-8202-202020202020','18181818-1818-4181-8181-181818181818',
  '44444444-4444-4444-4444-444444444444',3000,now(),now()),
 ('24242424-2424-4242-8242-242424242424','11111111-1111-1111-1111-111111111111',2026,
  '21212121-2121-4212-8212-212121212121','19191919-1919-4191-8191-191919191919',
  '44444444-4444-4444-4444-444444444444',4000,now(),now());
INSERT INTO public.mensalidades
 (escola_id,aluno_id,matricula_id,turma_id,ano_letivo,status,valor,valor_previsto,valor_original,valor_pago_total,desconto_aplicado,tabela_id)
VALUES
 ('11111111-1111-1111-1111-111111111111','25252525-2525-4252-8252-252525252525',
  '14141414-1414-4141-8414-141414141414','16161616-1616-4161-8161-161616161616',
  '2026','pendente',3000,3000,3000,0,0,'23232323-2323-4232-8232-232323232323');

DO $case$
DECLARE
 v_denied boolean := false;
BEGIN
 PERFORM set_config('klasse.fixture_allowed','off',true);
 BEGIN
  PERFORM public.retificar_classe_matricula(
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','66666666-6666-6666-6666-666666666666',
   'Correcao de classe documentada',true);
 EXCEPTION WHEN others THEN
  IF SQLERRM LIKE 'AUTH:%' THEN v_denied := true; ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Unauthorized reprice permitted'; END IF;
 PERFORM set_config('klasse.fixture_allowed','on',true);

 PERFORM set_config('klasse.fixture_school','31313131-3131-3131-3131-313131313131',true);
 v_denied := false;
 BEGIN
  PERFORM public.retificar_classe_matricula(
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','66666666-6666-6666-6666-666666666666',
   'Correcao de classe documentada',true);
 EXCEPTION WHEN others THEN
  IF SQLERRM LIKE 'DATA:%' THEN v_denied := true; ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Cross-school reprice permitted'; END IF;
 PERFORM set_config('klasse.fixture_school','11111111-1111-1111-1111-111111111111',true);

 BEGIN
  PERFORM public.retificar_classe_matricula(
   'dddddddd-dddd-dddd-dddd-dddddddddddd','ffffffff-ffff-ffff-ffff-ffffffffffff',
   'Teste de falta de tarifa de destino',true);
  RAISE EXCEPTION 'Missing price did not stop class correction';
 EXCEPTION WHEN sqlstate 'P1051' THEN NULL;
 END;
 IF (SELECT turma_id FROM public.matriculas WHERE id='dddddddd-dddd-dddd-dddd-dddddddddddd')
    IS DISTINCT FROM '55555555-5555-5555-5555-555555555555'::uuid
 THEN RAISE EXCEPTION 'Missing price changed enrollment before failure'; END IF;

 PERFORM public.retificar_classe_matricula(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','66666666-6666-6666-6666-666666666666',
  'Correcao de classe documentada',true);

 IF (SELECT turma_id FROM public.matriculas WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    IS DISTINCT FROM '66666666-6666-6666-6666-666666666666'::uuid
 THEN RAISE EXCEPTION 'Enrollment class change missing'; END IF;
 IF (SELECT count(*) FROM public.mensalidades
     WHERE matricula_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND status='pendente' AND valor=5000
       AND tabela_id='cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
       AND turma_id='66666666-6666-6666-6666-666666666666'::uuid) <> 8
 THEN RAISE EXCEPTION 'Unpaid tuition repricing failed'; END IF;
 IF (SELECT count(*) FROM public.mensalidades
     WHERE matricula_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND status='pago' AND valor=4000 AND valor_pago_total=4000) <> 2
 THEN RAISE EXCEPTION 'Settled months were overwritten'; END IF;
 IF (SELECT count(*) FROM public.mensalidades
     WHERE matricula_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND status='cancelado' AND valor=4000) <> 1
 THEN RAISE EXCEPTION 'Cancelled month was overwritten'; END IF;
 IF (SELECT count(*) FROM public.mensalidades
     WHERE matricula_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND status='pendente' AND valor IN (3900,4000)) <> 2
 THEN RAISE EXCEPTION 'Custom/authorized unpaid months were overwritten'; END IF;
 IF (SELECT count(*) FROM public.pagamentos WHERE status='settled' AND valor_pago=4000) <> 2
 THEN RAISE EXCEPTION 'Payments altered'; END IF;
 IF (SELECT count(*) FROM public.fixture_ledger WHERE delta=1000) <> 8
 THEN RAISE EXCEPTION 'Append-only ledger did not record 8 adjustments'; END IF;
 IF (SELECT sum(delta) FROM public.fixture_ledger) <> 8000
 THEN RAISE EXCEPTION 'Ledger adjustment sum incorrect'; END IF;
 IF (SELECT count(*) FROM public.audit_logs
     WHERE action='MATRICULA_CLASSE_RETIFICADA'
       AND details->>'mensalidades_reprecificadas'='8'
       AND details->>'mensalidades_para_revisao'='2') <> 1
 THEN RAISE EXCEPTION 'Audit lacks repricing and manual review counts'; END IF;
 IF EXISTS (SELECT 1 FROM public.balcao_pauta_turma_correction_nonce)
 THEN RAISE EXCEPTION 'Academic correction nonce leaked'; END IF;
END $case$;

-- The grade-6 to grade-7 cross-course correction must write a single record
-- and resolve the SECONDARY tariff (never reuse the PRIMARY course table).
DO $bridge$
BEGIN
 PERFORM public.retificar_classe_matricula(
  '14141414-1414-4141-8414-141414141414',
  '17171717-1717-4171-8171-171717171717',
  'Matrícula corrigida de sexta para sétima classe',true);
 IF NOT EXISTS (
  SELECT 1 FROM public.matriculas m
  WHERE m.id='14141414-1414-4141-8414-141414141414'
    AND m.turma_id='17171717-1717-4171-8171-171717171717'
    AND m.session_id='44444444-4444-4444-4444-444444444444'
    AND m.ano_letivo=2026
 ) THEN RAISE EXCEPTION 'Sixth to seventh cross-course correction failed'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.mensalidades mn
  WHERE mn.matricula_id='14141414-1414-4141-8414-141414141414'
    AND mn.status='pendente' AND mn.valor=4000
    AND mn.tabela_id='24242424-2424-4242-8242-242424242424'
    AND mn.turma_id='17171717-1717-4171-8171-171717171717'
 ) THEN RAISE EXCEPTION 'Secondary first-cycle tuition was not selected'; END IF;
 IF (SELECT COUNT(*) FROM public.fixture_ledger WHERE delta=1000) <> 9
 THEN RAISE EXCEPTION 'Expected exactly one additional cross-course ledger adjustment'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.audit_logs a
   WHERE a.action='MATRICULA_CLASSE_RETIFICADA'
     AND a.entity_id='14141414-1414-4141-8414-141414141414'
     AND a.details->>'mensalidades_reprecificadas'='1'
 ) THEN RAISE EXCEPTION 'Cross-course audit missing'; END IF;
END $bridge$;

ROLLBACK;
\echo 'Class correction + tuition repricing transactional regression passed'
