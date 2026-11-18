import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reopeningDisplayState, reopeningFeedback } from "../../src/lib/academico/reopening-display";

const before = Date.parse("2026-11-18T12:00:00Z");
const after = Date.parse("2026-11-18T15:00:00Z");
const expires = "2026-11-18T13:00:00Z";

test("pedido, aprovação e rejeição com autorização válida", () => {
  assert.equal(reopeningDisplayState("PENDENTE", expires, before), "PENDENTE");
  assert.equal(reopeningDisplayState("APROVADO", expires, before), "APROVADO");
  assert.equal(reopeningDisplayState("REJEITADO", expires, before), "REJEITADO");
});

test("expiração temporal e revogação por decisão são distintas", () => {
  assert.equal(reopeningDisplayState("PENDENTE", expires, after), "EXPIRADO");
  assert.equal(reopeningDisplayState("APROVADO", expires, after), "EXPIRADO");
  assert.equal(reopeningDisplayState("EXPIRADO", expires, before), "REVOGADO");
  assert.equal(reopeningDisplayState("EXPIRADO", expires, after), "REVOGADO");
});

test("cada estado apresenta a próxima acção, sem editar o estado académico na DB", () => {
  for (const key of ["PENDENTE", "APROVADO", "REJEITADO", "EXPIRADO", "REVOGADO"] as const) {
    assert.ok(reopeningFeedback[key].label.length > 0);
    assert.ok(reopeningFeedback[key].next.length > 15);
  }
});

test("dashboard do docente recarrega os pedidos sem reload após foco, decisão e intervalo moderado", () => {
  const component = readFileSync(resolve(process.cwd(),
    "src/components/professor/ProfessorReopeningRequests.tsx"), "utf8");
  const action = readFileSync(resolve(process.cwd(),
    "src/components/layout/operacoes/NotasReaberturaPanel.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(),
    "src/app/api/professor/notas/reabertura/route.ts"), "utf8");
  assert.match(component, /setInterval\(onVisible, 60_000\)/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /klasse:reabertura-atualizada/);
  assert.match(action, /dispatchEvent\(new Event\("klasse:reabertura-atualizada"\)\)/);
  assert.match(route, /reopeningDisplayState\(status as ReopeningStoredState, item\.expira_em, now\)/);
  assert.match(route, /\.eq\("solicitado_por", user\.id\)/);
  assert.doesNotMatch(route, /export async function PATCH/);
});
