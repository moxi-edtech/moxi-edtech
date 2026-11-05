"""Disposable fixture only: two actual PostgreSQL sessions retry the same operation."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse

url = os.environ['PGURL']
parsed = urlparse(url)
if parsed.hostname not in ('127.0.0.1', 'localhost') or not parsed.path.removeprefix('/').startswith('balcao_'):
    raise SystemExit('Refusing a non-disposable/non-loopback database')

def query(sql):
    r = subprocess.run(['psql', url, '-X', '-At', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout

# The regression rolls back every fixture. Seed the same synthetic school afresh.
seed = Path(__file__).with_name('regression.sql').read_text().split('SET LOCAL ROLE authenticated;')[0]
query(seed + '\nCOMMIT;')
payload = json.dumps({'motivo': 'Avaliação confirmada na ata oficial', 'disciplina_id': '70000000-0000-4000-8000-000000000001', 'suficiente': True, 'documento_fonte': 'ATA-CONCORRENCIA', 'expected_id': None})
command = f"""BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','registar_eja','{payload}','b0000000-0000-4000-8000-000000000001');
SELECT pg_sleep(0.25);
COMMIT;"""
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    responses = list(pool.map(query, [command, command]))
results = [next(json.loads(line) for line in response.splitlines() if line.startswith('{')) for response in responses]
assert results[0]['id'] == results[1]['id'], 'Concurrent retry duplicated evidence'
assert sum(r.get('idempotent') is True for r in results) == 1
counts = query('SELECT (SELECT count(*) FROM public.raa_eja_avaliacoes_oficiais),(SELECT count(*) FROM public.balcao_academic_operacoes),(SELECT count(*) FROM public.audit_logs)').strip()
assert counts == '1|1|1', f'Concurrent retry not atomic: {counts}'
print('BALCAO_CONCURRENT_RETRY_PASS')
