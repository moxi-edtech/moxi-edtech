import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = (file) => readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8");
const sql = readFileSync(new URL(
  "../../../../supabase/migrations/20271201090000_curtume_2025_documental_self_service.sql",
  import.meta.url), "utf8");

test("the document review route never bypasses tenant auth or uses a service-role key", () => {
  const route = src("app/api/secretaria/operacoes-academicas/notas-finais-2025/documentos/route.ts");
  assert.match(route, /db\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser\(db, user\.id, requestedSchool\)/);
  assert.match(route, /escolaId !== CURTUME/);
  assert.match(route, /\.eq\("escola_id", escolaId\)\.eq\("user_id", user\.id\)/);
  assert.match(route, /curtume_2025_documentos_pendentes/);
  assert.match(route, /curtume_2025_confirmar_pauta_documental/);
  assert.match(route, /curtume_2025_espelhar_notas_finais/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
  assert.doesNotMatch(route, /\.from\("notas"\).*\.insert\(/);
});

test("school must explicitly sign a document and original HIST_FINAL is reused", () => {
  const page = src("app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
  const widget = src("components/secretaria/CurtumeDocumentalReview.tsx");
  assert.match(page, /isCurtume && ano === 2025 && tipo === "historicos"/);
  assert.match(page, /<CurtumeDocumentalReview escola=\{escolaId\}/);
  assert.match(widget, /CONFIRMO_PAUTA_2025_2026/);
  assert.match(widget, /reference\.trim\(\)\.length < 8/);
  assert.match(widget, /reason\.trim\(\)\.length < 12/);
  assert.match(widget, /acao: "sincronizar_notas"/);
  assert.match(widget, /MAX_CHUNKS/);
  assert.doesNotMatch(widget, /fetch\(.+service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("document provenance is append-only, SHA-pinned and unexposed", () => {
  assert.match(sql, /internal\.curtume_2025_documento_revisoes/);
  assert.match(sql, /sha256\(/);
  assert.match(sql, /UNIQUE \(historico_disciplina_id, fonte_sha256\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE internal\.curtume_2025_documento_revisoes FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(sql, /FUNCTION_BASELINE_DRIFT/);
  assert.match(sql, /CONFIRMO_PAUTA_2025_2026/);
  assert.doesNotMatch(sql, /DISABLE TRIGGER|TRUNCATE|UPDATE public\.historico_disciplinas|DELETE FROM public\.notas/);
});
