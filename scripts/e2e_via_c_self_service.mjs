import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const idx = s.indexOf("=");
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = {
  ...readEnvFile("/Users/gundja/moxi-edtech/.env.local"),
  ...readEnvFile("/Users/gundja/moxi-edtech/.env.production.local"),
  ...readEnvFile("/Users/gundja/moxi-edtech/apps/formacao/.env.local"),
  ...readEnvFile("/Users/gundja/moxi-edtech/apps/web/.env.local"),
  ...process.env,
};

const SUPABASE_URL = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\n/g, "").trim();
const SUPABASE_ANON_KEY = String(env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\\n/g, "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim();
const E2E_BASE_URL = String(env.FORMACAO_E2E_BASE_URL || "http://localhost:3002").trim();
const E2E_ESCOLA_ID = String(env.FORMACAO_E2E_ESCOLA_ID || "8e154488-7c63-4105-86f0-5d58ad397202").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase envs (url/anon/service_role)");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: escola, error: escolaErr } = await admin
  .from("escolas")
  .select("id, slug, nome")
  .eq("id", E2E_ESCOLA_ID)
  .maybeSingle();

if (escolaErr) throw new Error(`escola lookup failed: ${escolaErr.message}`);
if (!escola?.slug) throw new Error("escola slug not found for E2E");

const { data: cohorts, error: cohortErr } = await admin
  .from("formacao_cohorts")
  .select("id, codigo, status")
  .eq("escola_id", E2E_ESCOLA_ID)
  .in("status", ["planeada", "em_andamento"])
  .order("created_at", { ascending: false })
  .limit(2);

if (cohortErr) throw new Error(`cohort lookup failed: ${cohortErr.message}`);
if (!cohorts || cohorts.length === 0) throw new Error("no eligible cohort (planeada|em_andamento) found");

const cohortA = String(cohorts[0].codigo || cohorts[0].id);
const cohortB = String((cohorts[1]?.codigo || cohorts[1]?.id || cohorts[0].codigo || cohorts[0].id));

const now = Date.now();
const userEmail = `self.viac.${now}@mailinator.com`;
const userPassword = "KlasseViaC!2026";
const biNumero = `BIVIAC${now}`;
const telefone = `92${String(now).slice(-7)}`;
const nome = `Formando Via C ${now}`;
const existingEmail = `self.viac.existing.${now}@mailinator.com`;
const existingPassword = "KlasseViaC!2026";
const existingBiNumero = `BIVIACEX${now}`;
const existingNome = `Formando Existente Via C ${now}`;
const existingTelefone = `93${String(now).slice(-7)}`;

const requestA = await fetch(`${E2E_BASE_URL}/api/formacao/admissoes`, {
  method: "POST",
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify({
    via: "self_service",
    centro_slug: escola.slug,
    cohort_ref: cohortA,
    nome,
    email: userEmail,
    bi_numero: biNumero,
    telefone,
    password: userPassword,
  }),
});
const bodyA = await requestA.json();

const { data: existingUserData, error: existingUserErr } = await admin.auth.admin.createUser({
  email: existingEmail,
  password: existingPassword,
  email_confirm: true,
  user_metadata: {
    nome: existingNome,
    role: "formando",
    tenant_type: "formacao",
  },
});
if (existingUserErr) throw new Error(`create existing user failed: ${existingUserErr.message}`);
const existingUserId = existingUserData.user?.id;
if (!existingUserId) throw new Error("create existing user did not return user id");

const { error: existingProfileErr } = await admin.from("profiles").upsert(
  {
    user_id: existingUserId,
    escola_id: E2E_ESCOLA_ID,
    current_escola_id: E2E_ESCOLA_ID,
    role: "formando",
    nome: existingNome,
    email: existingEmail,
    bi_numero: existingBiNumero,
    telefone: existingTelefone,
  },
  { onConflict: "user_id" }
);
if (existingProfileErr) throw new Error(`create existing profile failed: ${existingProfileErr.message}`);

const requestBNoPass = await fetch(`${E2E_BASE_URL}/api/formacao/admissoes`, {
  method: "POST",
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify({
    via: "self_service",
    centro_slug: escola.slug,
    cohort_ref: cohortB,
    nome: existingNome,
    email: existingEmail,
    bi_numero: existingBiNumero,
    telefone: existingTelefone,
  }),
});
const bodyBNoPass = await requestBNoPass.json();

const requestBWithPass = await fetch(`${E2E_BASE_URL}/api/formacao/admissoes`, {
  method: "POST",
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify({
    via: "self_service",
    centro_slug: escola.slug,
    cohort_ref: cohortB,
    nome: existingNome,
    email: existingEmail,
    bi_numero: existingBiNumero,
    telefone: existingTelefone,
    password: existingPassword,
  }),
});
const bodyBWithPass = await requestBWithPass.json();

const out = {
  escola: { id: escola.id, slug: escola.slug, nome: escola.nome },
  cohorts: { a: cohortA, b: cohortB },
  scenario_new_bi: { status: requestA.status, body: bodyA },
  scenario_existing_bi_without_password: { status: requestBNoPass.status, body: bodyBNoPass },
  scenario_existing_bi_with_password: { status: requestBWithPass.status, body: bodyBWithPass },
};

fs.writeFileSync("/tmp/e2e_via_c_self_service_result.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

assert(requestA.status === 200, `scenario A expected 200, got ${requestA.status}`);
assert(bodyA?.ok === true, "scenario A expected ok=true");
assert(bodyA?.created_new_user === true, "scenario A expected created_new_user=true");

assert(requestBNoPass.status === 409, `scenario B(no pass) expected 409, got ${requestBNoPass.status}`);
assert(bodyBNoPass?.code === "PASSWORD_REQUIRED", "scenario B(no pass) expected code=PASSWORD_REQUIRED");

assert(requestBWithPass.status === 200, `scenario B(with pass) expected 200, got ${requestBWithPass.status}`);
assert(bodyBWithPass?.ok === true, "scenario B(with pass) expected ok=true");
assert(bodyBWithPass?.created_new_user === false, "scenario B(with pass) expected created_new_user=false");
