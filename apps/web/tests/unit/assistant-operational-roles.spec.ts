import test from "node:test";
import assert from "node:assert/strict";
import { canUseOperationalCopilot, AI_ACTIONS_SECRETARIA_ROLES, AI_OPERATIONAL_COPILOT_ROLES } from "../../src/lib/roles/ai-roles";

test("copiloto usa a fonte canónica de papéis da Secretaria", () => {
  assert.equal(AI_OPERATIONAL_COPILOT_ROLES, AI_ACTIONS_SECRETARIA_ROLES);
  for (const role of AI_ACTIONS_SECRETARIA_ROLES) assert.equal(canUseOperationalCopilot(role), true);
});

test("financeiro, professor e aluno não têm acesso operacional", () => {
  for (const role of ["financeiro", "admin_financeiro", "secretaria_financeiro", "professor", "aluno", "encarregado", "", "ADMIN_FINANCEIRO"]) {
    assert.equal(canUseOperationalCopilot(role), false, role);
  }
});
