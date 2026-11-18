import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("Operações and Secretaria reuse the historical reconciliation screen and canonical API", () => {
  const sharedPath = "@/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page";
  for (const route of [
    "app/escola/[id]/(portal)/operacoes/academico/reconciliacao-historica/page.tsx",
    "app/escola/[id]/(portal)/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx",
  ]) {
    const alias = source(route);
    assert.ok(alias.includes('export { default } from "' + sharedPath + '"'), route);
    assert.doesNotMatch(alias, /fetch\(|supabase|ratificar_resultado/);
  }
  const page = source("app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
  assert.match(page, /inOperacoes \? "operacoes\/academico" : "secretaria\/operacoes-academicas"/);
  assert.match(page, /inOperacoes \? "historicos" : "pendentes"/);
  assert.match(page, /focus\?\.matricula_id/);
  assert.match(page, /Ratificar decisão/);
  assert.match(page, /Fechar histórico/);
});

test("selected tenant is server-authorized in GET and POST with exact roles", () => {
  const page = source("app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
  const api = source("app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
  const roles = source("lib/academico/authorize-balcao-academic-write.ts");
  const operationsRoles = source("lib/roles.ts");
  assert.match(page, /URLSearchParams\(\{ escola: escolaId, tipo, ano:/);
  assert.match(page, /JSON.stringify\(\{ \.\.\.body, escola: escolaId \}\)/);
  assert.match(api, /schoolSession\(requestedEscola\)/);
  assert.match(api, /resolveEscolaIdForUser\(supabase, user.id, requestedEscola\)/);
  assert.match(api, /\.eq\("escola_id", escolaId\)\.eq\("user_id", user.id\)/);
  assert.match(api, /canWriteHistoricalDecision\(supabase, escolaId\)/);
  assert.match(api, /ActionSchema.safeParse\(payload\)/);
  assert.match(roles, /"admin_financeiro"/);
  assert.match(roles, /"admin"/);
  assert.match(operationsRoles, /K12_OPERACOES_ROLE_GROUP = \[/);
  assert.match(operationsRoles, /'admin_financeiro'/);
  assert.match(operationsRoles, /'admin'/);
  assert.doesNotMatch(api, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Operações academic panel links to the mounted page", () => {
  const panel = source("app/secretaria/(portal-secretaria)/operacoes-academicas/page.tsx");
  assert.match(panel, /\/operacoes\/academico\/reconciliacao-historica/);
});
