import { existsSync, readFileSync } from "node:fs";
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
  assert.match(route, /action: z\.enum\(\["status", "solicitar", "emitir"\]\)/);
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

test("expand preserva emissão legada até deploy; contract revoga bypass depois", () => {
  const contract = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203003000_documentos_individuais_cutover_rpc_legacy.sql"), "utf8");
  assert.doesNotMatch(migration, /REVOKE ALL ON FUNCTION public\.emitir_documento_final_idempotente/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.emitir_documento_final_individual[^\n]+FROM PUBLIC, anon/);
  assert.match(contract, /REVOKE ALL ON FUNCTION public\.emitir_documento_final_idempotente/);
  assert.match(contract, /FROM PUBLIC, anon, authenticated/);
  assert.match(contract, /TO service_role/);
});

test("a Central é a única interface e API de emissão individual", () => {
  const endpointRedundante = resolve(process.cwd(), "src/app/api/secretaria/documentos/individual/route.ts");
  assert.equal(existsSync(endpointRedundante), false);
  const central = src("components/secretaria/SecretariaDocumentosWorkspace.tsx");
  assert.match(central, /DocumentosEmissaoHubClient/);
  const legado = src("components/secretaria/DocumentosEmissaoHub.tsx");
  assert.match(legado, /export \{ default \} from "\.\/DocumentosEmissaoHubClient"/);
  const hub = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  assert.doesNotMatch(hub, /api\/secretaria\/documentos\/individual/);
  assert.match(hub, /consultarDocumentoIndividual/);
  const client = src("lib/documentos/emissaoClient.ts");
  assert.match(client, /fetch\("\/api\/secretaria\/documentos\/emitir"/);
  assert.match(client, /action: input\.action/);
  const balcao = src("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(balcao, /window\.location\.assign\(href\)/);
  assert.match(balcao, /hrefEmissaoIndividual\(alunoId: string \| null, servico: Servico/);
  assert.doesNotMatch(balcao, /checkout\.emitirDocumento|emitirDocumentoViaApi/);
});

test("o pós-matrícula não emite documentos fora da Central", () => {
  const wizard = src("components/secretaria/AdmissaoWizardClient.tsx");
  assert.doesNotMatch(wizard, /import \{ emitirDocumento \} from/);
  assert.doesNotMatch(wizard, /postActionDocumentRequestRef/);
  assert.match(wizard, /params\.set\("alunoId", result\.aluno_id\)/);
  assert.match(wizard, /router\.push\(/);
});

test("checkout legado bloqueia serviços documentais antes da transação", () => {
  const balcao = src("components/secretaria/BalcaoAtendimento.tsx");
  const checkoutStart = balcao.indexOf('const checkout = useCallback(async (): Promise<boolean> => {');
  const financialPost = balcao.indexOf('fetch("/api/secretaria/pagamentos/processar"', checkoutStart);
  const guard = balcao.indexOf('carrinho.itens.some((item) =>', checkoutStart);
  assert.ok(checkoutStart >= 0 && guard > checkoutStart && financialPost > guard);
  assert.match(balcao.slice(guard, financialPost), /isTipoDocumentoEmitivel\(getDocTipo\(item\)\)/);
});

test("PR #455 e #456 coexistem no fluxo de admissão sem perder bolsa nem duplicar emissão", () => {
  const wizard = src("components/secretaria/AdmissaoWizardClient.tsx");
  assert.match(wizard, /Bolsa integral de estudo/);
  assert.match(wizard, /percentagemDesconto: 100, motivoDesconto: "Bolsa integral"/);
  assert.match(wizard, /const canAdvance = safeUuid\(sel\.turmaId\) && safeUuid\(candidaturaId\) && !saving && !error/);
  assert.match(wizard, /result\.comprovante\?\.printUrl/);
  assert.match(wizard, /router\.push\(\`\$\{secretariaBase\}\/documentos\?\$\{params\.toString\(\)\}\`\)/);
  assert.doesNotMatch(wizard, /postActionDocumentRequestRef/);
});


test("Central usa só a decisão canónica e apresenta ações de emissão, pagamento e aprovação", () => {
  const hub = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  assert.doesNotMatch(hub, /missingNotesFee|requiresPaidNotes|selectedServico|admin\/servicos/);
  assert.match(hub, /Emitir e imprimir/);
  assert.match(hub, /Aprovar emissão/);
  assert.match(hub, /Registar pagamento/);
  assert.match(hub, /Tentar novamente/);
  assert.match(hub, /estado\.status !== "pending_payment"/);
  assert.match(hub, /api\/secretaria\/documentos\/aprovacoes/);
  const fix = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203004000_documentos_individuais_gratuidade_ssot.sql"), "utf8");
  assert.doesNotMatch(fix, /OR p_tipo IN \('declaracao_notas'/);
  assert.match(fix, /OR p_tipo = 'boletim_trimestral'/);
  assert.match(fix, /exige_pagamento_antes_de_liberar/);
});
