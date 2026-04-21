import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const idx = s.indexOf('=');
    if (idx <= 0) continue;
    const key = s.slice(0, idx).trim();
    let val = s.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = {
  ...readEnvFile('/Users/gundja/moxi-edtech/.env.local'),
  ...readEnvFile('/Users/gundja/moxi-edtech/.env.production.local'),
  ...readEnvFile('/Users/gundja/moxi-edtech/apps/formacao/.env.local'),
  ...readEnvFile('/Users/gundja/moxi-edtech/apps/web/.env.local'),
  ...process.env,
};

const SUPABASE_URL = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').trim();
const SUPABASE_ANON_KEY = String(env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/\\n/g, '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();
const E2E_BASE_URL = String(env.FORMACAO_E2E_BASE_URL || 'http://localhost:3002').trim();
const E2E_ESCOLA_ID = String(env.FORMACAO_E2E_ESCOLA_ID || '8e154488-7c63-4105-86f0-5d58ad397202').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase envs (url/anon/service_role)');
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const cookieName = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const secretariaEmail = `viab.secretaria.dup.${Date.now()}@klasse.ao`;
const secretariaPassword = 'KlasseE2E!2026';

const created = await admin.auth.admin.createUser({
  email: secretariaEmail,
  password: secretariaPassword,
  email_confirm: true,
  user_metadata: { full_name: 'Secretaria Via B Duplicate E2E' },
});
if (created.error || !created.data.user?.id) {
  throw new Error(`createUser failed: ${created.error?.message || 'unknown'}`);
}

const userId = created.data.user.id;
const { error: euErr } = await admin.from('escola_users').upsert(
  {
    user_id: userId,
    escola_id: E2E_ESCOLA_ID,
    tenant_type: 'formacao',
    papel: 'formacao_secretaria',
  },
  { onConflict: 'user_id,escola_id' }
);
if (euErr) throw new Error(`escola_users upsert failed: ${euErr.message}`);

const { data: cohortRow, error: cohortErr } = await admin
  .from('formacao_cohorts')
  .select('id')
  .eq('escola_id', E2E_ESCOLA_ID)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (cohortErr) throw new Error(`cohort lookup failed: ${cohortErr.message}`);
if (!cohortRow?.id) throw new Error('No cohort found for escola');
const cohortId = String(cohortRow.id);

const signIn = await anon.auth.signInWithPassword({ email: secretariaEmail, password: secretariaPassword });
if (signIn.error || !signIn.data.session) {
  throw new Error(`signIn failed: ${signIn.error?.message || 'no session'}`);
}
const cookieVal = `base64-${base64url(JSON.stringify(signIn.data.session))}`;
const cookieHeader = `${cookieName}=${cookieVal}`;

const now = Date.now();
const dupEmail = `viab.dup2.aluno.${now}@mailinator.com`;
const dupBi = `BIDUP2${now}`;
const dupTel = `9360000${String(now).slice(-2)}`;

const payload = {
  cohort_id: cohortId,
  cliente_nome: `Empresa Via B DUP2 ${now}`,
  vencimento_em: '2026-05-10',
  descricao_cobranca: 'Mensalidade corporativa - lote E2E DUP2',
  valor_cobrado_padrao: 75000,
  criar_cobranca: true,
  rows: [
    { nome: `Aluno DUP2 1 ${now}`, email: dupEmail, bi_numero: dupBi, telefone: dupTel },
    { nome: `Aluno DUP2 1 REPEAT ${now}`, email: dupEmail, bi_numero: dupBi, telefone: dupTel },
    {
      nome: `Aluno DUP2 2 ${now}`,
      email: `viab.dup2.aluno2.${now}@mailinator.com`,
      bi_numero: `BIDUP2${now}2`,
      telefone: `9370000${String(now).slice(-2)}`,
    },
  ],
};

const apiRes = await fetch(`${E2E_BASE_URL}/api/formacao/secretaria/inscricoes/upload-b2b`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    cookie: cookieHeader,
  },
  body: JSON.stringify(payload),
});
const body = await apiRes.json();
const duplicateErrors = Array.isArray(body?.resultados)
  ? body.resultados.filter((r) => r.code === 'DUPLICATE_IN_PAYLOAD')
  : [];

const out = {
  status: apiRes.status,
  ok: body?.ok,
  resumo: body?.resumo,
  duplicate_error_count: duplicateErrors.length,
  duplicate_errors: duplicateErrors,
  cobranca: body?.cobranca || null,
};

fs.writeFileSync('/tmp/e2e_upload_b2b_duplicate_api_only_result.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

assert(apiRes.status === 200, `Expected status 200, got ${apiRes.status}`);
assert(body?.ok === false, 'Expected ok=false when duplicate row exists');
assert(Number(body?.resumo?.total ?? 0) === 3, 'Expected resumo.total == 3');
assert(Number(body?.resumo?.success ?? 0) === 2, 'Expected resumo.success == 2');
assert(Number(body?.resumo?.failed ?? 0) === 1, 'Expected resumo.failed == 1');
assert(duplicateErrors.length === 1, 'Expected exactly one DUPLICATE_IN_PAYLOAD error');
assert(body?.cobranca?.fatura?.id, 'Expected cobranca.fatura.id');
assert(Number(body?.cobranca?.itens_total ?? 0) === 2, 'Expected cobranca.itens_total == 2');
