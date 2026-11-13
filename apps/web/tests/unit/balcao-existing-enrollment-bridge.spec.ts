import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canLinkPaidOrderToExistingEnrollment } from "../../src/lib/rematricula/reconciliation-existing-enrollment";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const existing = {
  requestStatus: "pending_payment",
  paymentSettled: true,
  requestTargetYearId: "year-2026",
  selectedTargetYearId: "year-2026",
  requestTurmaId: "turma-8-A",
  existingEnrollmentId: "mat-2026",
  existingTurmaId: "turma-8-A",
  sourceEnrollmentId: "mat-2025",
};

test("confirmed payment and matching existing destination use an immediate reconciliation bridge", () => {
  assert.equal(canLinkPaidOrderToExistingEnrollment(existing), true);
});

test("pending intents, mismatched year/turma and same origin cannot be reinterpreted as a paid enrolled destination", () => {
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, paymentSettled: false }), false);
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, requestTargetYearId: "year-2025" }), false);
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, requestTurmaId: "turma-9-A" }), false);
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, existingEnrollmentId: existing.sourceEnrollmentId }), false);
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, existingTurmaId: null }), false);
  assert.equal(canLinkPaidOrderToExistingEnrollment({ ...existing, requestStatus: "cancelled" }), false);
});

test("status response verifies settled payment and school-scoped existing enrollment before exposing bridge", () => {
  const api = read("app/api/secretaria/balcao/rematriculas/status/route.ts");
  assert.match(api, /pedidoPagamentoLiquidado = pagamentosDoPedido\.some/);
  assert.match(api, /\.select\("id, status, meta"\)/);
  assert.match(api, /canLinkPaidOrderToExistingEnrollment\(/);
  assert.match(api, /can_link_existing_enrollment: podeAssociarMatriculaExistente/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.match(api, /\.eq\("aluno_id", aluno_id\)/);
});

test("Balcão offers existing-enrollment reconciliation without opening another turma selector", () => {
  const hook = read("hooks/useRematriculaBalcao.ts");
  const balc = read("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(hook, /setReconciliation\(data\.reconciliation \?\? null\)/);
  assert.match(hook, /setReconciliation\(null\)/);
  assert.match(balc, /rematricula\.reconciliation\?\.can_link_existing_enrollment\s*\? rematricula\.resolveReconciliation/);
  assert.match(balc, /paidExistingDestination \? "Concluir matrícula já paga"/);
  assert.match(balc, /showAcademicResolution && raaMatriculaId && raaAlunoId/);
  assert.match(balc, /const showAcademicResolution = !paidExistingDestination \|\| Boolean\(academicBlocker\)/);
  assert.doesNotMatch(balc, /<RematriculaAcademicDestination/);
  assert.match(balc, /skipTurmaSelection=\{[\s\S]*?RECONFIRMATION_REQUIRED/);
  assert.doesNotMatch(balc, /onResolverReconciliacao=\{rematricula\.openReconciliationModal\}/);
});

test("missing grades retain direct student-scoped grade entry, governed by existing source and permissions", () => {
  const balc = read("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(balc, /rematriculaCanWriteGrades &&/);
  assert.match(balc, /rematriculaAcademic\?\.disciplina_ids_pendentes\?\.\[0\]/);
  assert.match(balc, /Rever notas pendentes/);
  assert.match(balc, /if \(!rematricula\.canWriteGrades\) return/);
  assert.match(balc, /if \(rematricula\.academic\?\.regime\?\.escala === "qualitativa"\)/);
});

test("reconciliation API never silently accepts a different turma or year", () => {
  const api=read("app/api/secretaria/balcao/rematriculas/reconcile/route.ts");
  assert.match(api,/matriculaDestinoExistente\.turma_id \?\? ""\) !== destinoTurmaId/);
  assert.match(api,/matriculaDestinoExistente\.ano_letivo\) !== destinoAno/);
  assert.match(api,/RECONCILIATION_DESTINATION_MISMATCH/);
  assert.match(api,/\.in\("status", \["pending_payment", "granted"\]\)/);
  assert.match(api,/if \(linkError \|\| !linkedPedido/);
  assert.match(api,/emitirComprovanteMatricula/);
});
test("paid reserved destination is finalized before a document or another charge", () => {
  const status = read("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const reconcile = read("app/api/secretaria/balcao/rematriculas/reconcile/route.ts");
  const writer = read("app/api/secretaria/balcao/rematriculas/route.ts");
  assert.match(status, /if \(pagamentoSemProgressao\) \{\s*status = "RECONCILIATION_REQUIRED"/);
  assert.match(status, /const pedidoPagoComReserva = pedidoExistente\?\.status === "granted"/);
  assert.match(status, /pedidoPagoComReserva \|\| canLinkPaidOrderToExistingEnrollment/);
  assert.match(reconcile, /const destinoAtivo = matriculaDestinoExistente\.ativo === true/);
  assert.match(reconcile, /if \(!destinoAtivo\) \{[\s\S]*?rpc\("finalizar_rematricula_balcao"/);
  assert.match(reconcile, /RECONCILIATION_FINALIZATION_REQUIRED/);
  assert.match(writer, /if \(matriculaDestino\?\.id && !destinoJaAtivo\)/);
  assert.match(writer, /pedidoDaReserva[\s\S]*?code: "REMATRICULA_RECONCILIATION_REQUIRED"/);
  assert.match(writer, /let mensalidadesDestinoSelecionadas: any\[\] = \[\]/);
  assert.ok(writer.indexOf("if (pedidoDaReserva)") < writer.indexOf("let mensalidadesDestinoSelecionadas"),
    "the paid-order recovery must preempt a stale monthly basket");
});

test("destination quote excludes paid monthly fees under school/student and keeps valid selections", () => {
  const quoteApi = read("app/api/financeiro/orcamento/matricula/route.ts");
  const quoteHook = read("hooks/useRematriculaMensalidadesDestino.ts");
  assert.match(quoteApi, /aluno_id/);
  assert.match(quoteApi, /\.eq\("escola_id", escolaId\)/);
  assert.match(quoteApi, /\.eq\("aluno_id", alunoId\)/);
  assert.match(quoteApi, /\.eq\("matricula_id", destino\.id\)/);
  assert.match(quoteApi, /\["pago", "isento", "cancelado"\]/);
  assert.match(quoteHook, /aluno_id: alunoId/);
  assert.match(quoteHook, /\.filter\(item => !item\.previsto \|\| stillOpen\.has\(item\.id\)\)/);
});

test("verified absence-justification decisions provide an in-place action, without fabricating attendance", () => {
  const panel=read("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  assert.match(panel,/pendingJustification = cases\.find/);
  assert.match(panel,/item\.kind === "justificacao"/);
  assert.match(panel,/chooseCase\(pendingJustification\)/);
  assert.match(panel,/Rever faltas/);
  const source=read("app/api/secretaria/faltas/justificacoes/route.ts");
  assert.match(source,/requireRoleInSchool/);
  assert.match(source,/\.eq\("matricula_id", matriculaId\)/);
});
