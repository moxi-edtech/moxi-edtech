"""Disposable PostgreSQL only. Executes the proposed SQL and captured existing triggers verbatim.
APPYPAY_TEST_DATABASE_URL=postgresql:///appypay_services_test?host=/private/tmp/klasse-appypay-pg&port=55439
Production schema/RLS outside the fixture are not covered. Never point this script at Supabase.
"""
import os, pathlib, subprocess, uuid, json, concurrent.futures
url = os.environ['APPYPAY_TEST_DATABASE_URL']
assert 'host=/private/tmp/klasse-appypay-pg' in url and '/appypay_services_test?' in url
root = pathlib.Path(__file__).resolve().parents[3]
def run(sql, ok=True):
    result = subprocess.run(['psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', url], input=sql, text=True, capture_output=True)
    if ok: assert result.returncode == 0, result.stderr
    return result
fixture = '''
ALTER ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT null::uuid$$;
CREATE TYPE public.pagamento_metodo AS ENUM ('cash','tpa','transfer','mcx','kwik');
CREATE TABLE escolas(id uuid PRIMARY KEY);
CREATE TABLE school_payment_providers(id uuid PRIMARY KEY,school_id uuid,provider_type text,status text);
CREATE TABLE servicos_escola(id uuid PRIMARY KEY,escola_id uuid,exige_aprovacao boolean);
CREATE TABLE servico_pedidos(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,servico_escola_id uuid,valor_cobrado numeric,status text,reason_code text,servico_codigo text,servico_nome text);
CREATE TABLE pagamento_intents(id uuid PRIMARY KEY,escola_id uuid,aluno_id uuid,servico_pedido_id uuid,amount numeric,currency text,status text,method text,reference text,terminal_id text,evidence_url text,created_by uuid,settled_at timestamptz,meta jsonb DEFAULT '{}');
CREATE TABLE payment_provider_events(provider_id uuid,school_id uuid,idempotency_key text,payload jsonb,status text,error_message text,processed_at timestamptz);
CREATE TABLE audit_logs(escola_id uuid,actor_id uuid,action text,entity text,entity_id text,portal text,details jsonb);
CREATE TABLE pagamentos(escola_id uuid,aluno_id uuid,mensalidade_id uuid,pagamento_intent_id uuid,valor_pago numeric,data_pagamento date,metodo pagamento_metodo,metodo_pagamento text,status text,reference text,evidence_url text,gateway_ref text,created_by uuid,settled_at timestamptz,settled_by uuid,meta jsonb,idempotency_key text);
CREATE UNIQUE INDEX fixture_payment_intent_unique ON pagamentos(pagamento_intent_id) WHERE pagamento_intent_id IS NOT NULL;
GRANT USAGE ON SCHEMA public,auth TO service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
'''
if os.environ.get('APPYPAY_RETEST') != '1':
    run(fixture)
    run((root/'apps/web/tests/fixtures/appypay-existing-triggers.sql').read_text())
    run('''CREATE TRIGGER fixture_boletim_before BEFORE UPDATE OF status ON pagamento_intents FOR EACH ROW EXECUTE FUNCTION boletim_payment_transition_guard();
CREATE TRIGGER fixture_boletim_after AFTER UPDATE OF status ON pagamento_intents FOR EACH ROW EXECUTE FUNCTION boletim_payment_transition_guard();
CREATE TRIGGER fixture_materialize AFTER INSERT OR UPDATE ON pagamento_intents FOR EACH ROW EXECUTE FUNCTION financeiro_materialize_intent_payment();''')
    run((root/'docs/financeiro/appypay-portal-services.proposed.sql').read_text())
def seed(approval=False):
    ids = {k:str(uuid.uuid4()) for k in ('school','student','provider','service','order','intent','ref','charge','actor')}
    i=ids
    payload=json.dumps({'id':i['charge'],'amount':1500,'merchantTransactionId':'fixturemerchant','responseStatus':{'source':'REF','successful':True,'status':'Success','code':100}})
    run(f"""INSERT INTO escolas VALUES ('{i['school']}');
INSERT INTO school_payment_providers VALUES ('{i['provider']}','{i['school']}','appypay','active');
INSERT INTO servicos_escola VALUES ('{i['service']}','{i['school']}',{str(approval).lower()});
INSERT INTO servico_pedidos VALUES ('{i['order']}','{i['school']}','{i['student']}','{i['service']}',1500,'pending_payment',null,'DOC_BOLETIM_TRIMESTRAL','Boletim');
INSERT INTO pagamento_intents(id,escola_id,aluno_id,servico_pedido_id,amount,currency,status,method,created_by) VALUES ('{i['intent']}','{i['school']}','{i['student']}','{i['order']}',1500,'AOA','draft','transfer','{i['actor']}');
INSERT INTO appypay_service_references(id,school_id,obligation_id,intent_id,provider_id,provider_reference_id,entity,reference,amount,status,expires_at,provider_payload) VALUES ('{i['ref']}','{i['school']}','{i['order']}','{i['intent']}','{i['provider']}','{i['charge']}','00123','123456789',1500,'active',now()+interval '1 day','{{"merchant_id":"fixturemerchant"}}');
INSERT INTO payment_provider_events(provider_id,school_id,idempotency_key,payload,status) VALUES ('{i['provider']}','{i['school']}','appypay:{i['charge']}','{payload}','pending');""")
    return ids
def confirm(i):
    return f"SET ROLE service_role; SET request.jwt.claim.role='service_role'; SELECT appypay_confirm_service_payment('{i['ref']}','{i['charge']}')->>'status';"
i=seed()
for role in ('anon','authenticated'):
    assert run(f"SET ROLE {role}; SELECT appypay_confirm_service_payment('{i['ref']}','{i['charge']}');",False).returncode != 0
    assert run(f"SET ROLE {role}; SELECT * FROM appypay_service_references;",False).returncode != 0
print('PASS: students/anonymous cannot read privileged reservations or confirm payment directly')
# Exact captured boletim guard and canonical payment materializer run here.
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results=list(pool.map(lambda _:run(confirm(i)),range(2)))
assert all(r.stdout.strip()=='reconciled' for r in results)
assert run(f"SELECT count(*) FROM pagamentos WHERE pagamento_intent_id='{i['intent']}';").stdout.strip()=='1'
assert run(f"SELECT count(*) FROM audit_logs WHERE entity_id='{i['intent']}';").stdout.strip()=='2'
assert run(f"SELECT status FROM servico_pedidos WHERE id='{i['order']}';").stdout.strip()=='granted'
paid_at=run(f"SELECT paid_at FROM appypay_service_references WHERE id='{i['ref']}';").stdout.strip()
run(confirm(i));assert run(f"SELECT paid_at FROM appypay_service_references WHERE id='{i['ref']}';").stdout.strip()==paid_at
print('PASS: concurrent callbacks settle once, exercise draft->pending->settled, grant the order and preserve paid_at')
i=seed(True);run(confirm(i));assert run(f"SELECT status FROM servico_pedidos WHERE id='{i['order']}';").stdout.strip()=='blocked'
assert run(f"SELECT status FROM pagamento_intents WHERE id='{i['intent']}';").stdout.strip()=='settled'
print('PASS: services requiring approval remain blocked after successful payment')
i=seed();run(f"UPDATE servico_pedidos SET valor_cobrado=2000 WHERE id='{i['order']}';")
assert run(confirm(i)).stdout.strip()=='manual_review'
assert run(f"SELECT count(*) FROM pagamentos WHERE pagamento_intent_id='{i['intent']}';").stdout.strip()=='0'
print('PASS: changed service amount enters manual review without a financial posting')
i=seed();run(f"UPDATE payment_provider_events SET payload=jsonb_set(payload,'{{responseStatus,code}}','101') WHERE idempotency_key='appypay:{i['charge']}';")
assert 'APPYPAY_EVENT_INVALID' in run(confirm(i),False).stderr
assert run(f"SELECT status FROM pagamento_intents WHERE id='{i['intent']}';").stdout.strip()=='draft'
print('PASS: unverified/processing event cannot settle even through the machine function')

i=seed()
holder=subprocess.Popen(['psql','-XqAt','-v','ON_ERROR_STOP=1',url],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
holder.stdin.write(f"BEGIN; UPDATE pagamento_intents SET amount=2000 WHERE id='{i['intent']}';\n\\echo LOCKED\nSELECT pg_sleep(1); COMMIT;\n");holder.stdin.close()
assert holder.stdout.readline().strip()=='LOCKED'
assert run(confirm(i)).stdout.strip()=='manual_review'
assert holder.wait(timeout=5)==0
assert run(f"SELECT count(*) FROM pagamentos WHERE pagamento_intent_id='{i['intent']}';").stdout.strip()=='0'
print('PASS: concurrent intent amount update is serialized by the SQL row lock and prevents settlement')
