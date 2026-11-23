import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const src = (path) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203002000_documentos_individuais_pagamento_ssot.sql"), "utf8");

test("emissão individual exige pagamento no backend e não confia no frontend", () => {
  const emitir = src("app/api/secretaria/documentos/emitir/route.ts");
  assert.match(emitir, /rpc\("documento_individual_acesso"/);
  assert.match(emitir, /access\?\.granted !== true/);
  assert.match(emitir, /rpc\("emitir_documento_final_individual"/);
});

test("estado financeiro vincula matrícula, ano, serviço e autorização", () => {
  const route = src("app/api/secretaria/documentos/emitir/route.ts");
  assert.match(route, /action: z\\.enum\\(\\["status", "solicitar", "emitir"\\]\\)/);
  assert.match(route, /\.eq\("session_id", academicContext!\.anoLetivoId\)/);
  assert.match(route, /documento_individual_acesso/);
  assert.match(migration, /pg\.status = 'settled'/);
  assert.match(migration, /pg\.meta->>'pagamento_intent_id' = v_intent\.id::text/);
  assert.match(migration, /pg\.meta->>'pedido_id' = v_pedido\.id::text/);
});

test("registro de TPA/transferência não auto-liquida por origem do cliente", () => {
  const route = src("app/api/secretaria/balcao/pagamentos/route.ts");
  assert.doesNotMatch(route, /isBalcaoEmissao/);
  assert.match(route, /normalizedMetodo === "cash" \? "settled" : "pending"/);
  assert.match(route, /DOCUMENT_PAYMENT_CONTEXT_MISMATCH/);
  assert.match(migration, /ux_pagamento_documento_individual_intent/);
});

test("impressão falhada e reimpressão não passam pelo pagamento", () => {
  const hub = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  const api = src("app/api/secretaria/documentos/emitir/route.ts");
  assert.match(hub, /Imprimir novamente/);
  assert.match(hub, /setDocumentState\(\{\s*\.\.\.documentState, status: "issued"/);
  assert.match(api, /status: "issued", granted: true/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock\(/);
  assert.match(migration, /ux_documento_individual_emitido_por_matricula/);
});

test("pagamento de boletim não é fungível com declaração com notas", () => {
  assert.match(migration, /WHEN 'declaracao_notas' THEN 'DOC_DECLARACAO_NOTAS'/);
  assert.match(migration, /WHEN 'boletim_trimestral' THEN 'DOC_BOLETIM_TRIMESTRAL'/);
  assert.match(migration, /AND servico_codigo = v_codigo/);
});

test("migração revoga wrapper anterior de emission e não permite acesso anónimo", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.emitir_documento_final_idempotente[^\n]+FROM PUBLIC, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.emitir_documento_final_individual[^\n]+FROM PUBLIC, anon/);
});
