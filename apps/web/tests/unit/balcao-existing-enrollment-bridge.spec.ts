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
  assert.match(balc, /paidExistingDestination \? "Associar pagamento à matrícula"/);
  assert.match(balc, /!paidExistingDestination && raaMatriculaId && raaAlunoId/);
  assert.match(balc, /!paidExistingDestination && \(/);
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
