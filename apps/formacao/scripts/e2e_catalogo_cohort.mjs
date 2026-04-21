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
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = Date.now();
const email = `catalogo.secretaria.${now}@klasse.ao`;
const password = "KlasseE2E!2026";

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Secretaria Catalogo E2E" },
});
if (created.error || !created.data.user?.id) {
  throw new Error(`createUser failed: ${created.error?.message || "unknown"}`);
}
const userId = created.data.user.id;

const { error: euErr } = await admin.from("escola_users").upsert(
  {
    user_id: userId,
    escola_id: E2E_ESCOLA_ID,
    tenant_type: "formacao",
    papel: "formacao_secretaria",
  },
  { onConflict: "user_id,escola_id" }
);
if (euErr) throw new Error(`escola_users upsert failed: ${euErr.message}`);

const signIn = await anon.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.session) {
  throw new Error(`signIn failed: ${signIn.error?.message || "no session"}`);
}
const cookieVal = `base64-${base64url(JSON.stringify(signIn.data.session))}`;
const cookieHeader = `${cookieName}=${cookieVal}`;

const cursoPayload = {
  codigo: `CUR-${String(now).slice(-6)}`,
  nome: `Curso Catálogo ${now}`,
  area: "Tecnologia",
  modalidade: "hibrido",
  carga_horaria: 40,
  preco_tabela: 75000,
  desconto_ativo: true,
  desconto_percentual: 10,
  parceria_b2b_ativa: true,
  modulos: [
    { titulo: "Introdução", carga_horaria: 8, descricao: "Fundamentos" },
    { titulo: "Prática Guiada", carga_horaria: 16, descricao: "Exercícios reais" },
    { titulo: "Projeto Final", carga_horaria: 16, descricao: "Entrega final" },
  ],
};

const cursoRes = await fetch(`${E2E_BASE_URL}/api/formacao/backoffice/cursos`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookieHeader },
  body: JSON.stringify(cursoPayload),
});
const cursoBody = await cursoRes.json();
if (cursoRes.status !== 200 || !cursoBody?.ok || !cursoBody?.item?.id) {
  throw new Error(`curso create failed: status=${cursoRes.status}`);
}
const cursoId = String(cursoBody.item.id);

const cohortPayload = {
  codigo: `TUR-${String(now).slice(-6)}`,
  nome: `Turma Catálogo ${now}`,
  curso_id: cursoId,
  vagas: 25,
  data_inicio: "2026-05-01",
  data_fim: "2026-06-15",
  status: "planeada",
};

const cohortRes = await fetch(`${E2E_BASE_URL}/api/formacao/backoffice/cohorts`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookieHeader },
  body: JSON.stringify(cohortPayload),
});
const cohortBody = await cohortRes.json();
if (cohortRes.status !== 200 || !cohortBody?.ok || !cohortBody?.item?.id) {
  throw new Error(`cohort create failed: status=${cohortRes.status} body=${JSON.stringify(cohortBody)}`);
}
const cohortId = String(cohortBody.item.id);

const { data: cohortDb, error: cohortDbErr } = await admin
  .from("formacao_cohorts")
  .select("id, curso_nome, carga_horaria_total")
  .eq("escola_id", E2E_ESCOLA_ID)
  .eq("id", cohortId)
  .single();
if (cohortDbErr) throw new Error(`cohort db check failed: ${cohortDbErr.message}`);

const { data: refDb, error: refErr } = await admin
  .from("formacao_cohort_financeiro")
  .select("valor_referencia")
  .eq("escola_id", E2E_ESCOLA_ID)
  .eq("cohort_id", cohortId)
  .maybeSingle();
if (refErr) throw new Error(`ref db check failed: ${refErr.message}`);

const { data: modsDb, error: modsErr } = await admin
  .from("formacao_cohort_modulos")
  .select("id, ordem, titulo")
  .eq("escola_id", E2E_ESCOLA_ID)
  .eq("cohort_id", cohortId)
  .order("ordem", { ascending: true });
if (modsErr) throw new Error(`snapshot db check failed: ${modsErr.message}`);

assert(String(cohortDb?.curso_nome || "") === cursoPayload.nome, "cohort curso_nome not autopopulated from curso");
assert(Number(cohortDb?.carga_horaria_total || 0) === 40, "cohort carga_horaria_total not autopopulated");
assert(Number(refDb?.valor_referencia || 0) === 75000, "valor_referencia not pulled from curso comercial");
assert(Array.isArray(modsDb) && modsDb.length === 3, "cohort module snapshot count mismatch");

const out = {
  ok: true,
  curso: { id: cursoId, nome: cursoPayload.nome },
  turma: {
    id: cohortId,
    curso_nome: cohortDb?.curso_nome,
    carga_horaria_total: cohortDb?.carga_horaria_total,
  },
  financeiro: { valor_referencia: refDb?.valor_referencia ?? null },
  snapshot_modulos: modsDb?.map((item) => ({ ordem: item.ordem, titulo: item.titulo })) ?? [],
};

fs.writeFileSync("/tmp/e2e_catalogo_cohort_result.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
