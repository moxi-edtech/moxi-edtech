import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { findIssuedOperationalReceipt } from "../../src/lib/financeiro/recover-receipt-after-payment";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("delayed operational receipt resolves by GET only, without additional payment", async () => {
  const calls: string[] = [];
  let attempts = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls.push(options?.method ?? "GET");
    assert.match(String(url), /\/api\/secretaria\/recibos\/consultar\?mensalidade_id=/);
    attempts += 1;
    return new Response(JSON.stringify(attempts < 3
      ? { ok: true, status: "pending" }
      : { ok: true, status: "ready", print_url: "/secretaria/documentos/issued-uuid/recibo/print" }), {
      status: attempts < 3 ? 202 : 200,
      headers: { "content-type": "application/json" },
    });
  };
  const url = await findIssuedOperationalReceipt("monthly-uuid", {
    fetcher, pause: async () => undefined, attempts: 5,
  });
  assert.equal(url, "/secretaria/documentos/issued-uuid/recibo/print");
  assert.deepEqual(calls, ["GET", "GET", "GET"]);
});

test("pending outbox never triggers an automatic second payment or receipt emission", async () => {
  const methods: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return new Response(JSON.stringify({ ok: true, status: "pending" }), {
      status: 202, headers: { "content-type": "application/json" },
    });
  };
  const url = await findIssuedOperationalReceipt("monthly-uuid", {
    fetcher, pause: async () => undefined, attempts: 2,
  });
  assert.equal(url, null);
  assert.deepEqual(methods, ["GET", "GET"]);
});

test("untrusted print destinations cannot replace authenticated document routes", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    ok: true, status: "ready", print_url: "https://other-domain.example/receipt",
  }));
  const url = await findIssuedOperationalReceipt("monthly-uuid", {
    fetcher, pause: async () => undefined, attempts: 1,
  });
  assert.equal(url, null);
});

test("receipt lookup validates user, staff role, school, monthly and issued document", () => {
  const route = source("app/api/secretaria/recibos/consultar/route.ts");
  assert.match(route, /supabaseServerTyped/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /context\(studentId, parsed\.data\.escola_id\)/);
  assert.match(route, /resolveEscolaIdForUser\(db, user\.id, requestedEscolaId\)/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("aluno_id", monthly\.aluno_id\)/);
  assert.match(route, /\.eq\("tipo", "recibo"\)/);
  assert.match(route, /\.is\("revoked_at", null\)/);
  assert.match(route, /status: "pending"/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(route, /fiscal_emitir_/);
});

test("rapid checkout reserves print tab before fetch and does not generate another payment on polling", () => {
  const code = source("components/secretaria/ModalPagamentoRapido.tsx");
  const submit = code.slice(code.indexOf("const submit = useCallback(async () =>"));
  assert.ok(submit.indexOf("reserveReceiptWindow()") >= 0);
  assert.ok(submit.indexOf("reserveReceiptWindow()") < submit.indexOf('await fetch("/api/secretaria/pagamentos/processar"'));
  assert.match(submit, /pendingCheckout\.current\.key/);
  assert.match(submit, /findIssuedOperationalReceipt\(lastMonthlyId/);
  assert.match(submit, /showIssuedReceipt\(receiptWindow, recoveredUrl\)/);
  assert.match(code, /Pagamento confirmado — recibo em preparação/);
  assert.match(code, /Verificar recibo sem repetir pagamento/);
  assert.doesNotMatch(code, /setTimeout\(\(\) => window\.print\(\)/);
});

test("current-year enrollment status uses active school year, not historical dossier selection", () => {
  const route = source("app/api/secretaria/alunos/[id]/matricula-corrente/route.ts");
  assert.match(route, /resolveAnoLetivoScope\(db, escolaId\)/);
  assert.match(route, /\.eq\("ano_letivo", activeYear\.ano\)/);
  assert.match(route, /current\.session_id !== activeYear\.id/);
  assert.match(route, /current\.ativo !== \(canonicalEnrollmentStatus\(current\.status\) === "ativa"\)/);
  assert.match(route, /enrollments\.length > 1/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /\.eq\("escola_id", escolaId\)\.eq\("aluno_id", studentId\)/);
});

test("confirm current enrollment only resumes settled, issued, linked and academically eligible existing reservation", () => {
  const route = source("app/api/secretaria/alunos/[id]/matricula-corrente/route.ts");
  assert.match(route, /confirmationSchema/);
  assert.match(route, /origem_transicao_matricula_id/);
  assert.match(route, /status", "settled"/);
  assert.match(route, /servico_codigo", "SERV_REMATRICULA"/);
  assert.match(route, /summarizeOverdueRematriculaDebt/);
  assert.match(route, /recibo_doc_id/);
  assert.match(route, /receiptPaymentId = snapshot\.pagamento_id/);
  assert.match(route, /receiptIntentId = snapshot\.pagamento_intent_id/);
  assert.match(route, /"ENROLLMENT_RECEIPT_MISMATCH"/);
  assert.match(route, /rpc\("finalizar_rematricula_balcao"/);
  assert.match(route, /"ENROLLMENT_STALE"/);
  assert.match(route, /"ENROLLMENT_RECONCILIATION_REQUIRED"/);
  assert.doesNotMatch(route, /rpc\("confirmar_matricula"/);
  assert.doesNotMatch(route, /\.from\("pagamentos"\)[\s\S]{0,200}\.insert\(/);
  assert.doesNotMatch(route, /fiscal_emitir_/);
});

test("full profile and Command Center share the same class correction and current-year confirmation component", () => {
  const profile = source("components/aluno/AlunoPerfilPage.tsx");
  const commandCenter = source("components/secretaria/command-center/CommandCenterStudentDossier.tsx");
  const panel = source("components/aluno/CurrentYearEnrollmentPanel.tsx");
  // "Perfil" is the default DossierTabs view; the action MUST be visible
  // there, not hidden only behind the "Matrícula" tab.
  assert.match(profile, /slotPerfil=\{\([\s\S]*?<CurrentYearEnrollmentPanel alunoId=\{alunoId\}/);
  assert.match(commandCenter, /slotPerfil=\{\([\s\S]*?<CurrentYearEnrollmentPanel[\s\S]*?alunoId=\{alunoId\}/);
  assert.match(profile, /slotMatricula=\{<CurrentYearEnrollmentPanel alunoId=\{alunoId\}/);
  assert.match(panel, /RetificarMatriculaAction/);
  assert.match(panel, /matricula-corrente\?escolaId=/);
  assert.match(panel, /escola_id: escolaId/);
  const correctionForm = source("components/secretaria/TransferForm.tsx");
  assert.match(correctionForm, /useState\(canRectifyClass && defaultRectifyClass\)/);
  assert.match(action, /Corrigir classe/);
  assert.match(action, /defaultRectifyClass=\{canRectifyClass\}/);
  // The correct year ID comes from the authenticated server scope and
  // must reach the modal without an optional secondary session lookup.
  assert.match(panel, /anoLetivoId=\{state\.matricula\.anoLetivoId\}/);
  const action = source("components/aluno/RetificarMatriculaAction.tsx");
  assert.match(action, /anoLetivoId=\{anoLetivoId \?\? sessionId\}/);
  const tabs = source("components/aluno/DossierTabs.tsx");
  assert.match(tabs, /: "perfil"/);
  assert.match(panel, /canRectifyClass/);
  assert.match(panel, /canConfirm/);
  assert.match(panel, /confirmar: true/);
  assert.match(panel, /matricula-corrente/);
  assert.match(panel, /Abrir Balcão de Atendimento/);
});

test("class correction stays an audited transactional move, never deletes linked historical data", () => {
  const api = source("app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts");
  const migration = readFileSync(
    new URL("../../../../supabase/migrations/20261019104203_retificacao_classe_matricula_20261018.sql", import.meta.url), "utf8",
  );
  assert.match(api, /requireRoleInSchool/);
  assert.match(api, /assertAcademicYearEntity/);
  assert.match(api, /retificar_classe_matricula/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /v_historico_apos IS DISTINCT FROM v_historico/);
  assert.match(migration, /MATRICULA_CLASSE_RETIFICADA/);
  assert.doesNotMatch(migration, /DELETE FROM public\.(?:notas|pagamentos|mensalidades|documentos_emitidos)/i);
});
