import test from "node:test";
import assert from "node:assert/strict";
import { canUseOperationalCopilot, AI_ACTIONS_SECRETARIA_ROLES, AI_OPERATIONAL_COPILOT_ROLES } from "../../src/lib/roles/ai-roles";

test("copiloto preserva papéis da Secretaria e o perfil composto do Dashboard de Operações", () => {
  assert.deepEqual(AI_OPERATIONAL_COPILOT_ROLES, [...AI_ACTIONS_SECRETARIA_ROLES, "admin_financeiro"]);
  for (const role of AI_OPERATIONAL_COPILOT_ROLES) assert.equal(canUseOperationalCopilot(role), true);
  assert.equal(canUseOperationalCopilot("ADMIN_FINANCEIRO"), true, "papel composto no portal Operações");
});

test("financeiro, professor e aluno não têm acesso operacional", () => {
  for (const role of ["financeiro", "secretaria_financeiro", "professor", "aluno", "encarregado", "", "operacoes"]) {
    assert.equal(canUseOperationalCopilot(role), false, role);
  }
});

test("papel composto Admin/Financeiro também fica autorizado na lista enviada ao RPC de escola", () => {
  assert.ok(AI_OPERATIONAL_COPILOT_ROLES.includes("admin_financeiro"));
  assert.ok(!AI_OPERATIONAL_COPILOT_ROLES.includes("financeiro"));
});
