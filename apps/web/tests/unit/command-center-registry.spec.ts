import assert from "node:assert/strict";
import test from "node:test";

import {
  BALCAO_ACTION_REGISTRY,
  buildBalcaoActionHref,
  getBalcaoWorkspaceActions,
} from "../../src/lib/balcao/action-registry";

test("todas as ações do Command Center têm um painel canónico", () => {
  const actions = getBalcaoWorkspaceActions();

  assert.deepEqual(
    actions.map((action) => action.id),
    ["desk", "enrollment", "payment", "document", "reenrollment", "profile", "grade"],
  );

  for (const action of actions) {
    assert.equal(action.surface, "command-center");
    assert.ok(action.panel);
  }
});

test("ações operacionais mapeiam para as views canónicas do balcão", () => {
  assert.equal(BALCAO_ACTION_REGISTRY.desk.panel, "balcao");
  assert.equal(BALCAO_ACTION_REGISTRY.desk.balcaoView, "overview");

  assert.equal(BALCAO_ACTION_REGISTRY.enrollment.panel, "enrollment");
  assert.equal(BALCAO_ACTION_REGISTRY.enrollment.requiresStudent, false);

  assert.equal(BALCAO_ACTION_REGISTRY.payment.panel, "balcao");
  assert.equal(BALCAO_ACTION_REGISTRY.payment.balcaoView, "payment");

  assert.equal(BALCAO_ACTION_REGISTRY.document.panel, "balcao");
  assert.equal(BALCAO_ACTION_REGISTRY.document.balcaoView, "document");

  assert.equal(BALCAO_ACTION_REGISTRY.reenrollment.panel, "balcao");
  assert.equal(BALCAO_ACTION_REGISTRY.reenrollment.balcaoView, "reenrollment");

  assert.equal(BALCAO_ACTION_REGISTRY.profile.panel, "profile");
  assert.equal(BALCAO_ACTION_REGISTRY.grade.panel, "grade");
});

test("Secretaria e Operações usam deep link do mesmo Command Center", () => {
  const href = buildBalcaoActionHref({
    escolaParam: "escola-demo",
    portal: "secretaria",
    alunoId: "aluno-1",
    alunoLabel: "João Manuel",
    actionId: "payment",
  });

  assert.match(href, /\/secretaria\/balcao\?/);
  assert.match(href, /alunoId=aluno-1/);
  assert.match(href, /action=payment/);
});

test("portais fora do atendimento preservam os destinos próprios", () => {
  const paymentHref = buildBalcaoActionHref({
    escolaParam: "escola-demo",
    portal: "financeiro",
    alunoId: "aluno-1",
    alunoLabel: "João Manuel",
    actionId: "payment",
  });
  assert.match(paymentHref, /\/financeiro\/pagamentos\?/);

  const gradeHref = buildBalcaoActionHref({
    escolaParam: "escola-demo",
    portal: "professor",
    alunoId: "aluno-1",
    alunoLabel: "João Manuel",
    actionId: "grade",
  });
  assert.match(gradeHref, /\/professor\/notas\?/);
});


test("matrícula abre no mesmo Command Center sem exigir aluno pré-selecionado", () => {
  const href = buildBalcaoActionHref({
    escolaParam: "escola-demo",
    portal: "secretaria",
    actionId: "enrollment",
  });

  assert.match(href, /\/secretaria\/balcao\?/);
  assert.match(href, /action=enrollment/);
  assert.equal(BALCAO_ACTION_REGISTRY.desk.requiresStudent, false);
  assert.equal(BALCAO_ACTION_REGISTRY.enrollment.requiresStudent, false);
});


test("nova matrícula nunca carrega alunoId anterior no deep link", () => {
  const href = buildBalcaoActionHref({
    escolaParam: "escola-demo",
    portal: "secretaria",
    alunoId: "aluno-anterior",
    actionId: "enrollment",
  });
  const url = new URL(href, "https://klasse.test");
  assert.equal(url.searchParams.get("action"), "enrollment");
  assert.equal(url.searchParams.has("alunoId"), false);
});

test("pagamentos e rematrícula preservam o aluno selecionado", () => {
  for (const actionId of ["payment", "reenrollment"] as const) {
    const href = buildBalcaoActionHref({
      escolaParam: "escola-demo",
      portal: "secretaria",
      alunoId: "aluno-123",
      actionId,
    });
    const url = new URL(href, "https://klasse.test");
    assert.equal(url.searchParams.get("alunoId"), "aluno-123");
    assert.equal(url.searchParams.get("action"), actionId);
  }
});
