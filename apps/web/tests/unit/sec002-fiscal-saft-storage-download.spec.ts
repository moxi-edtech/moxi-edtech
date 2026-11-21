import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../../src/app/api/fiscal/saft/export/[exportId]/download/route.ts", import.meta.url), "utf8",
);
const migration = readFileSync(
  new URL("../../../../supabase/migrations/20271121140000_fiscal_saft_authenticated_download_storage_rls.sql", import.meta.url), "utf8",
);
const turmas = readFileSync(
  new URL("../../src/app/escola/[id]/(portal)/admin/configuracoes/turmas/page.tsx", import.meta.url), "utf8",
);

test("SEC-002: endpoint fiscal humano não usa service_role nem cliente admin", () => {
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin|getSupabaseAdmin|createClient\s*\(/);
  assert.match(route, /await supabaseRouteClient<Database>\(\)/);
  assert.match(route, /await supabase\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser\(supabase, user\.id\)/);
  assert.match(route, /requireFiscalAccessByCompanyOrSchool/);
  assert.match(route, /await supabase\.storage\s*\.from\(SAFT_BUCKET\)\s*\.createSignedUrl/);
});

test("assinatura respeita estado da exportação e TTL curto; mantém contrato HTTP", () => {
  assert.match(route, /SIGNED_URL_TTL_SECONDS = 300/);
  assert.match(route, /"validated", "submitted", "generated"/);
  assert.match(route, /arquivo_storage_path/);
  assert.match(route, /return jsonError\(401, "UNAUTHENTICATED"/);
  assert.match(route, /if \(!access\.ok\)/);
  assert.match(route, /download_url: signedUrl/);
  assert.match(route, /expires_in_seconds: SIGNED_URL_TTL_SECONDS/);
  assert.match(route, /fetchCache = "force-no-store"/);
});

test("RLS do Storage: SELECT autorizado apenas no bucket privado e no objecto exato", () => {
  assert.match(migration, /CREATE POLICY fiscal_saft_authenticated_export_download/);
  assert.match(migration, /ON storage\.objects\s+FOR SELECT\s+TO authenticated/);
  assert.match(migration, /bucket_id = 'fiscal-saft'/);
  assert.match(migration, /auth\.uid\(\) IS NOT NULL/);
  assert.match(migration, /FROM public\.fiscal_saft_exports AS saft/);
  assert.match(migration, /ltrim\(saft\.arquivo_storage_path, '\/'\) = storage\.objects\.name/);
  assert.match(migration, /saft\.status IN \('generated', 'validated', 'submitted'\)/);
  assert.match(migration, /public\.user_has_role_in_empresa/);
  assert.match(migration, /ARRAY\['owner', 'admin', 'operator'\]/);
  assert.doesNotMatch(migration, /FOR ALL|TO anon|TO public|CREATE POLICY [^\n]+INSERT/);
});

test("hotfix Turmas preserva toast sem reativar callback instável", () => {
  assert.match(turmas, /rawToast\(\{/);
  assert.match(turmas, /title: "Erro ao carregar dados acadêmicos\."/);
  assert.match(turmas, /\[rawToast, escolaId, escolaParam\]/);
  assert.doesNotMatch(turmas, /error\("Erro ao carregar dados acadêmicos\."\)/);
});
