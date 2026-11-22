import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("Curtume preview is strictly read-only and never publishes historical grades", () => {
  const route = read("app/api/secretaria/operacoes-academicas/notas-finais-2025/status/route.ts");
  assert.match(route, /export async function GET\(/);
  assert.doesNotMatch(route, /export async function POST\(|createAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(route, /curtume_2025_prever_espelhamento_notas/);
  assert.doesNotMatch(route, /\.rpc\("curtume_2025_espelhar_notas_finais"/);
  assert.match(route, /no-store/);
});

test("Curtume preview requires authenticated requested tenant and exact school role", () => {
  const route = read("app/api/secretaria/operacoes-academicas/notas-finais-2025/status/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser\(supabase, user\.id, requestedSchool\)/);
  assert.match(route, /escolaId !== CURTUME_ID/);
  assert.match(route, /\.eq\("escola_id", escolaId\)\.eq\("user_id", user\.id\)/);
  assert.match(route, /ALLOWED_ROLES\.has/);
  assert.match(route, /Number\.isSafeInteger\(value\)/);
  assert.match(route, /data\.total !== counts\.slice\(1\)\.reduce/);
});

test("existing operations page shows preview only in Curtume's 2025/26 historical context", () => {
  const page = read("app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
  const component = read("components/secretaria/CurtumeNotasFinaisStatus.tsx");
  assert.match(page, /isCurtume && ano === 2025 && tipo === "historicos"/);
  assert.match(page, /<CurtumeNotasFinaisStatus (?:key=\{reload\} )?escola=\{escolaId\}/);
  assert.match(component, /\/notas-finais-2025\/status\?escola=/);
  assert.match(component, /preview\.elegiveis === 0/);
  assert.doesNotMatch(component, /sincronizar_finais_2025|Sincronizar notas finais/);
});
