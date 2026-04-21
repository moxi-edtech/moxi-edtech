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

const rootEnv = readEnvFile('/Users/gundja/moxi-edtech/.env.local');
const rootProdEnv = readEnvFile('/Users/gundja/moxi-edtech/.env.production.local');
const formacaoEnv = readEnvFile('/Users/gundja/moxi-edtech/apps/formacao/.env.local');
const webEnv = readEnvFile('/Users/gundja/moxi-edtech/apps/web/.env.local');
const env = { ...rootEnv, ...rootProdEnv, ...formacaoEnv, ...webEnv, ...process.env };

const SUPABASE_URL = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\n/g, '').trim();
const SUPABASE_ANON_KEY = String(env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/\n/g, '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\n/g, '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase envs (url/anon/service_role)');
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const cookieName = `sb-${projectRef}-auth-token`;
const escolaId = '8e154488-7c63-4105-86f0-5d58ad397202';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `viab.secretaria.dup.${Date.now()}@klasse.ao`;
const password = 'KlasseE2E!2026';

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Secretaria Via B Duplicate E2E' },
});
if (created.error || !created.data.user?.id) {
  throw new Error(`createUser failed: ${created.error?.message || 'unknown'}`);
}
const userId = created.data.user.id;

const { error: euErr } = await admin.from('escola_users').upsert({
  user_id: userId,
  escola_id: escolaId,
  tenant_type: 'formacao',
  papel: 'formacao_secretaria',
}, { onConflict: 'user_id,escola_id' });
if (euErr) throw new Error(`escola_users upsert failed: ${euErr.message}`);

const { data: cohortRow, error: cohortErr } = await admin
  .from('formacao_cohorts')
  .select('id')
  .eq('escola_id', escolaId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (cohortErr) throw new Error(`cohort lookup failed: ${cohortErr.message}`);
if (!cohortRow?.id) throw new Error('No cohort found for escola');
const cohortId = String(cohortRow.id);

const signIn = await anon.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.session) {
  throw new Error(`signIn failed: ${signIn.error?.message || 'no session'}`);
}
const sessionJson = JSON.stringify(signIn.data.session);
const cookieVal = `base64-${base64url(sessionJson)}`;
const cookieHeader = `${cookieName}=${cookieVal}`;

const now = Date.now();
const dupEmail = `viab.dup.aluno.${now}@mailinator.com`;
const dupBi = `BIDUP${now}`;
const dupTel = `9330000${String(now).slice(-2)}`;

const payload = {
  cohort_id: cohortId,
  cliente_nome: `Empresa Via B DUP ${now}`,
  vencimento_em: '2026-05-10',
  descricao_cobranca: 'Mensalidade corporativa - lote E2E DUP',
  valor_cobrado_padrao: 90000,
  criar_cobranca: true,
  rows: [
    { nome: `Aluno DUP 1 ${now}`, email: dupEmail, bi_numero: dupBi, telefone: dupTel },
    { nome: `Aluno DUP 1 REPEAT ${now}`, email: dupEmail, bi_numero: dupBi, telefone: dupTel },
    { nome: `Aluno DUP 2 ${now}`, email: `viab.dup.aluno2.${now}@mailinator.com`, bi_numero: `BIDUP${now}2`, telefone: `9340000${String(now).slice(-2)}` }
  ]
};

const apiRes = await fetch('http://localhost:3002/api/formacao/secretaria/inscricoes/upload-b2b', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'cookie': cookieHeader,
  },
  body: JSON.stringify(payload),
});

const apiBody = await apiRes.json();
const duplicateErrors = Array.isArray(apiBody?.resultados)
  ? apiBody.resultados.filter((r) => r.code === 'DUPLICATE_IN_PAYLOAD')
  : [];

let dbCheck = null;
if (apiBody?.cobranca?.fatura?.id) {
  const faturaId = apiBody.cobranca.fatura.id;
  const { data: itens, error: itensErr } = await admin
    .from('formacao_faturas_lote_itens')
    .select('id, formando_user_id')
    .eq('escola_id', escolaId)
    .eq('fatura_lote_id', faturaId);
  if (itensErr) throw new Error(`itens check failed: ${itensErr.message}`);
  dbCheck = { fatura_id: faturaId, itens_count: (itens || []).length };
}

const out = {
  login_user: email,
  cohort_id: cohortId,
  status: apiRes.status,
  ok: apiBody?.ok,
  resumo: apiBody?.resumo,
  duplicate_error_count: duplicateErrors.length,
  duplicate_errors: duplicateErrors,
  cobranca: apiBody?.cobranca || null,
  db_check: dbCheck,
};

fs.writeFileSync('/tmp/e2e_upload_b2b_duplicate_result.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
