r"""SQL lock tests, disposable PostgreSQL only. Never point this at a remote DB.
Usage: APPYPAY_TEST_DATABASE_URL=postgresql:///appypay_test?host=/private/tmp/klasse-appypay-pg\&port=55439 python3 apps/web/tests/appypay-atomic-local.py
The existing confirmation RPC is a fixture; the proposed wrapper is executed verbatim.
"""
import os, subprocess, pathlib, concurrent.futures
url = os.environ['APPYPAY_TEST_DATABASE_URL']
assert 'host=/private/tmp/klasse-appypay-pg' in url and '/appypay_test?' in url, 'Disposable local database required'
root = pathlib.Path(__file__).resolve().parents[3]
def run(sql, ok=True):
    p = subprocess.run(['psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', url], input=sql, text=True, capture_output=True)
    if ok: assert p.returncode == 0, p.stderr
    return p
fixture = '''
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE TABLE public.finance_payment_intents (id uuid PRIMARY KEY, escola_id uuid, mensalidade_id uuid, amount numeric, currency text, method text, external_ref text, dedupe_key text, status text);
CREATE TABLE public.mensalidades (id uuid PRIMARY KEY, escola_id uuid, valor numeric, valor_previsto numeric, valor_pago_total numeric, status text);
CREATE TABLE public.school_payment_providers (id uuid PRIMARY KEY, school_id uuid, provider_type text, status text);
CREATE TABLE public.payment_references (id uuid PRIMARY KEY, school_id uuid, obligation_id uuid, provider_id uuid, provider_reference_id text, amount numeric, currency text);
CREATE TABLE public.fixture_confirmations (id uuid);
CREATE FUNCTION public.can_manage_school(school uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT school::text = current_setting('request.jwt.claim.school',true) $$;
CREATE FUNCTION public.finance_confirm_payment(p_intent_id uuid) RETURNS public.finance_payment_intents LANGUAGE plpgsql AS $$
DECLARE i public.finance_payment_intents;
BEGIN
 SELECT * INTO i FROM public.finance_payment_intents WHERE id=p_intent_id FOR UPDATE;
 IF i.status='confirmed' THEN RETURN i; END IF;
 PERFORM 1 FROM public.mensalidades WHERE id=i.mensalidade_id FOR UPDATE;
 UPDATE public.mensalidades SET valor_pago_total=valor_pago_total+i.amount,status='pago' WHERE id=i.mensalidade_id;
 INSERT INTO public.fixture_confirmations VALUES (i.id);
 UPDATE public.finance_payment_intents SET status='confirmed' WHERE id=i.id RETURNING * INTO i;
 RETURN i;
END $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
'''
if os.environ.get('APPYPAY_RETEST') != '1': run(fixture)
run((root/'docs/financeiro/appypay-confirm-payment.proposed.sql').read_text())
school='00000000-0000-4000-8000-000000000001'; other='00000000-0000-4000-8000-000000000002'
obligation='00000000-0000-4000-8000-000000000003'; provider='00000000-0000-4000-8000-000000000004'
intent='00000000-0000-4000-8000-000000000005'; charge='00000000-0000-4000-8000-000000000006'
ref='00000000-0000-4000-8000-000000000007'
if os.environ.get('APPYPAY_RETEST') != '1': run(f"INSERT INTO school_payment_providers VALUES ('{provider}','{school}','appypay','active'); INSERT INTO mensalidades VALUES ('{obligation}','{school}',1500,1500,0,'pendente'); INSERT INTO finance_payment_intents VALUES ('{intent}','{school}','{obligation}',1500,'AOA','referencia','{charge}','appypay:{charge}','pending'); INSERT INTO payment_references VALUES ('{ref}','{school}','{obligation}','{provider}','{charge}',1500,'AOA');")
def confirm(s=school):
    return f"SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.school='{s}'; SELECT status FROM appypay_confirm_payment('{intent}');"
if os.environ.get('APPYPAY_RETEST') == '1':
    run("TRUNCATE fixture_confirmations; UPDATE finance_payment_intents SET status='pending'; UPDATE mensalidades SET valor_pago_total=0,status='pendente';")
assert 'APPYPAY_FORBIDDEN' in run(confirm(other),False).stderr
assert run("SELECT count(*) FROM fixture_confirmations;").stdout.strip()=='0'
assert run(f"SET ROLE anon; SELECT appypay_confirm_payment('{intent}');",False).returncode != 0
print('PASS: foreign tenant and anonymous caller rejected')
# Hold a real row lock while another payment changes the outstanding balance.
holder=subprocess.Popen(['psql','-XqAt','-v','ON_ERROR_STOP=1',url],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
holder.stdin.write(f"BEGIN; UPDATE mensalidades SET valor_pago_total=500 WHERE id='{obligation}';\n\\echo LOCKED\nSELECT pg_sleep(1); COMMIT;\n");holder.stdin.close()
assert holder.stdout.readline().strip()=='LOCKED'
assert 'APPYPAY_BALANCE_CHANGED' in run(confirm(),False).stderr
assert holder.wait(timeout=5)==0
assert run("SELECT count(*) FROM fixture_confirmations;").stdout.strip()=='0'
print('PASS: concurrent balance update blocks and prevents settlement')
run(f"UPDATE mensalidades SET valor_pago_total=0 WHERE id='{obligation}';")
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results=list(pool.map(lambda _:run(confirm()),range(2)))
assert all(r.stdout.strip()=='confirmed' for r in results)
assert run("SELECT count(*) FROM fixture_confirmations;").stdout.strip()=='1'
assert run("SELECT valor_pago_total FROM mensalidades;").stdout.strip()=='1500'
print('PASS: simultaneous duplicate confirmations settle once')
